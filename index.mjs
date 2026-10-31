/** Shared CodeMirror 6 code; each consumer owns and disposes its own view. */
import {EditorState,Compartment} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine,highlightActiveLineGutter,drawSelection} from '@codemirror/view';
import {defaultKeymap,history,historyKeymap,undo,redo,indentMore,indentLess} from '@codemirror/commands';
import {syntaxHighlighting,defaultHighlightStyle} from '@codemirror/language';
import {RegExpCursor} from '@codemirror/search';
import {python} from '@codemirror/lang-python';
import {javascript} from '@codemirror/lang-javascript';
import {cpp} from '@codemirror/lang-cpp';

export function mount(){throw Error('CodeMirror is a shared system tool, not a window.');}
export function createEditor({parent,text='',wrap=true,path='',dirty=false,onChange=()=>{},onSelection=()=>{}}){
 if(!(parent instanceof HTMLElement)||typeof text!=='string'||typeof onChange!=='function'||typeof onSelection!=='function')throw Error('Invalid editor options');
 let view,savedDoc=null,closed=false,readOnly=false,currentWrap=!!wrap,currentPath=path;const wrapping=new Compartment(),editing=new Compartment(),language=new Compartment(),attributes=new Compartment();
 const syntax=p=>/\.py$/i.test(p)?python():/\.(?:js|mjs|cjs|jsx|ts|tsx)$/i.test(p)?javascript({typescript:/\.tsx?$/i.test(p),jsx:/\.[jt]sx$/i.test(p)}):/\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx|ino)$/i.test(p)?cpp():[];
 const inputAttributes=()=>EditorView.contentAttributes.of({'aria-label':'Text document','autocapitalize':'off','autocomplete':'off','spellcheck':'false',inputmode:document.documentElement.dataset.keyboardMode==='voice'?'none':'text'});
 const config=()=>[syntaxHighlighting(defaultHighlightStyle),lineNumbers(),highlightActiveLine(),highlightActiveLineGutter(),drawSelection(),history(),keymap.of([...defaultKeymap,...historyKeymap]),wrapping.of(currentWrap?EditorView.lineWrapping:[]),editing.of([EditorState.readOnly.of(readOnly),EditorView.editable.of(!readOnly)]),language.of(syntax(currentPath)),attributes.of(inputAttributes()),EditorView.theme({'&':{height:'100%',font:'inherit'},'.cm-scroller':{overflow:'auto',fontFamily:'inherit'},'.cm-content':{minHeight:'100%'}}),EditorView.updateListener.of(update=>{if(update.docChanged)onChange();if(update.selectionSet||update.docChanged)onSelection();})];
 view=new EditorView({state:EditorState.create({doc:text,extensions:config()}),parent});if(!dirty)savedDoc=view.state.doc;
 const keyboardMode=()=>{if(!closed)view.dispatch({effects:attributes.reconfigure(inputAttributes())});};document.addEventListener('codi-keyboard-mode',keyboardMode);
 const input=view.contentDOM;input.codiVoiceCapture=()=>{const doc=view.state.doc,{from,to}=view.state.selection.main;return {element:input,valid:()=>!closed&&!readOnly&&view.state.doc===doc,insert:value=>{if(closed||readOnly)return;view.dispatch({changes:{from,to,insert:value},selection:{anchor:from+value.length},scrollIntoView:true});}};};
 return Object.freeze({
  getText:()=>view.state.doc.toString(),getInfo(){const doc=view.state.doc,at=doc.lineAt(view.state.selection.main.head);return {length:doc.length,lines:doc.lines,line:at.number,column:view.state.selection.main.head-at.from+1};},lineOffset(number){return view.state.doc.line(number).from;},selectedText(){const {from,to}=view.state.selection.main;return view.state.doc.sliceString(from,to);},snapshot:()=>view.state.doc,markSaved(doc){savedDoc=doc;},isClean:()=>!!savedDoc&&view.state.doc.eq(savedDoc),getSelection:()=>{const s=view.state.selection.main;return {from:s.from,to:s.to,head:s.head};},
  replaceDocument(value,newPath=currentPath){if(closed)throw Error('Editor is closed');const previousPath=currentPath;currentPath=newPath;try{const next=EditorState.create({doc:value,extensions:config()});view.setState(next);savedDoc=view.state.doc;}catch(error){currentPath=previousPath;throw error;}},
  select(from,to=from){view.dispatch({selection:{anchor:from,head:to},scrollIntoView:true});},selectAll(){view.dispatch({selection:{anchor:0,head:view.state.doc.length},scrollIntoView:true});view.focus();},
  findAll(query,matchCase=false){if(!query)return [];const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const cursor=new RegExpCursor(view.state.doc,escaped,{ignoreCase:!matchCase}),out=[];while(!cursor.next().done){if(out.length===50000){out.truncated=true;break;}out.push([cursor.value.from,cursor.value.to]);}return out;},
  findFrom(query,matchCase,position,direction){
   if(!query)return null;const doc=view.state.doc,escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),options={ignoreCase:!matchCase},pos=Math.max(0,Math.min(doc.length,position));
   const first=(from,to)=>{const cursor=new RegExpCursor(doc,escaped,options,from,to);return cursor.next().done?null:[cursor.value.from,cursor.value.to];};
   const last=(from,to)=>{for(let end=to;end>from;){const start=Math.max(from,end-10000),cursor=new RegExpCursor(doc,escaped,options,Math.max(0,start-query.length),Math.min(doc.length,end+query.length));let match=null;while(!cursor.next().done){const {from:at,to:finish}=cursor.value;if(at>=start&&at<end)match=[at,finish];if(at>=end)break;}if(match)return match;end=start;}return null;};
   return direction>0?(first(pos,doc.length)||first(0,doc.length)):(last(0,pos)||last(pos,doc.length));
  },
  selectionMatches(query,matchCase=false){if(!query)return false;const {from,to}=view.state.selection.main;if(from===to||to-from>query.length*2+2)return false;const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('^(?:'+escaped+')$',matchCase?'u':'iu').test(view.state.doc.sliceString(from,to));},
  replace(from,to,text){view.dispatch({changes:{from,to,insert:text},selection:{anchor:from+text.length},userEvent:'input.replace',scrollIntoView:true});view.focus();},
  replaceAll(ranges,text){view.dispatch({changes:ranges.map(([from,to])=>({from,to,insert:text})),userEvent:'input.replace.all'});view.focus();},
  undo(){undo(view);view.focus();},redo(){redo(view);view.focus();},indent(){indentMore(view);view.focus();},outdent(){indentLess(view);view.focus();},
  focus(){view.focus();},blur(){view.contentDOM.blur();},setPath(value){if(closed)throw Error('Editor is closed');currentPath=value;view.dispatch({effects:language.reconfigure(syntax(currentPath))});},setWrap(value){currentWrap=!!value;view.dispatch({effects:wrapping.reconfigure(currentWrap?EditorView.lineWrapping:[])});},
  setReadOnly(value){readOnly=!!value;view.dispatch({effects:editing.reconfigure([EditorState.readOnly.of(readOnly),EditorView.editable.of(!readOnly)])});},
  destroy(){if(closed)return;closed=true;document.removeEventListener('codi-keyboard-mode',keyboardMode);delete input.codiVoiceCapture;view.destroy();}
 });
}
