import { sampleGardenReportSections } from '../lib/sample-garden-reports.ts';
import { SAMPLE_GARDENS } from '../lib/sample-gardens.ts';
import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { compileActualComponent, accountNodeText } from './account-ui-renderer.ts';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';
import { programmeReportText, programmeMetricText, programmeReportFileName, isProgrammeDraftLanguage, PROGRAMME_REVIEW_SOURCE, EXAMPLE_REPORT_REVIEW_SOURCE } from '../lib/programme-report-copy.ts';
import { numberLabel } from '../lib/format-figures.ts';
import { programmeReportMetrics } from '../lib/programme-report-pdf.ts';
import { fieldDataReportNote } from '../lib/field-request-model.ts';
import { freshEvidenceData, trainingFeedbackSummary, TRAINING_PHOTO_KINDS } from '../lib/programme-evidence.ts';
export async function actualProgrammeReportUi(initial:ControlLanguage, options:{visual?:boolean;funder?:boolean;failure?:boolean;defer?:boolean;session?:any;example?:boolean}={}){
 let lang=initial,renderer!:ReactTestRenderer,resolve:undefined|(()=>void);
 const evidence=freshEvidenceData(),session=options.example?undefined:options.session??evidence.sessions[0],calls={pdf:[]as any[],files:[]as any[],assets:[]as any[],svg:[]as string[]};
 const photos=[{image:'data:image/png;base64,QA',caption:'QA owned Ṱanḓa {count} $& photo',kind:'activity'}];
 const sections=options.example?sampleGardenReportSections(SAMPLE_GARDENS[0],initial):[{title:'QA owned {title} $& chapter',lines:['QA owned Ṱanḓa {count} $& evidence']}];
 const visuals={title:'QA site {name} $&',language:'en',metrics:[],charts:[],basis:'QA source basis',subtitle:''};
 const scope:Record<string,unknown>={React,...React,programmeReportText,programmeMetricText,programmeReportFileName,isProgrammeDraftLanguage,PROGRAMME_REVIEW_SOURCE,EXAMPLE_REPORT_REVIEW_SOURCE,numberLabel,programmeReportMetrics,fieldDataReportNote,trainingFeedbackSummary,TRAINING_PHOTO_KINDS,
  useLanguage:()=>({lang,t:controlT(lang)}),useAuth:()=>({profile:{role:'farmer',org_id:'qa-org'}}),isSampleMode:()=>true,sampleRead:()=>evidence,freshEvidenceData,
  fieldApi:()=>{throw Error('A provided branding fixture must never read an account');},styles:{},reportStyles:{},visualStyles:{},SignatureImage:({name}:any)=>React.createElement('span',null,name),
  ReportVisualOverview:({language}:any)=>React.createElement('section',{'data-overview-language':language},'QA visual boundary'),
  svgImage:async(svg:string)=>{calls.svg.push(svg);return 'data:image/png;base64,QA';},
  prepareVisualPdfAssets:async(...args:any[])=>{calls.assets.push(args);return{charts:{},photos:[]};},
  buildProgrammePdf:async(...args:any[])=>{calls.pdf.push(args);if(options.defer)await new Promise<void>(r=>resolve=r);if(options.failure)throw Error('QA PDF refused');return{output:()=>new Blob(['QA PDF'])};},
  deliverFile:async(...args:any[])=>calls.files.push(args),
 };
 scope.TrainingFeedbackFindings=compileActualComponent('components/TrainingFeedback.tsx','TrainingFeedbackFindings',scope);
 const Report=compileActualComponent('components/ReportComposer.tsx','ReportComposer',scope),props={title:'QA owned Ṱanḓa {name} $& title',sample:true,sections,contentLanguage:options.example?initial:undefined,sourceSections:options.example?sampleGardenReportSections(SAMPLE_GARDENS[0]):undefined,session,branding:evidence.branding,photos,photosByDefault:true,visuals:options.visual?visuals:undefined,funder:!!options.funder};
 await act(async()=>{renderer=create(React.createElement(Report,props));});
 return{renderer,calls,session,sections,props,text:()=>accountNodeText(renderer.root),
  async language(next:ControlLanguage){lang=next;await act(async()=>renderer.update(React.createElement(Report,props)));},
  async click(label:string){await act(async()=>{const node=renderer.root.findAll(n=>n.type==='button'&&accountNodeText(n)===label)[0];if(!node)throw Error('Missing report action '+label);const result=node.props.onClick();if(!options.defer)await result;});},
  async photos(value:boolean){await act(async()=>renderer.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:value}}));},
  async finish(){await act(async()=>resolve?.());},async dispose(){await act(async()=>renderer.unmount());},
 };
}
