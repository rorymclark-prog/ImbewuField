'use client';
import { numberLabel } from '@/lib/format-figures';
import { Users, Leaf, Droplets, Sprout, AlertTriangle, Pencil, Check, Circle, ClipboardCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import type { ReactNode } from 'react';
import type { SiteSurvey, ProductionCategory } from '@/lib/site-survey';
import styles from './SiteSurveySheet.module.css';
import SurveyZuluDraftPair from './SurveyZuluDraftPair';

const LABELS: Record<string, string> = {
  food:'goalFoodSecurityLabel',income:'goalGenerateIncomeLabel',soil:'challengePoorSoil',education:'goalDemonstrateTeachLabel',
  municipal:'waterSourceMunicipalTap',borehole:'waterSourceBorehole',river:'waterSourceRiverStream',rainwater:'waterSourceRainwater',grey:'waterSourceGreyWater',
  drip:'waterDeliveryDripLabel',sprinkler:'waterDeliverySprinklerLabel',piped:'waterDeliveryPipedLabel',gravity:'waterDeliveryGravityLabel',bucket:'waterDeliveryBucketLabel',flood:'waterDeliveryFloodLabel',
  jojo:'waterStorageJojoTanks',dam:'waterStorageEarthDam',pond:'waterStoragePond',cistern:'waterStorageCistern',
  hand:'landPrepHandToolsLabel',tractor:'landPrepTractorLabel',animal:'landPrepAnimalLabel',
  healthy:'soilConditionHealthy',compacted:'soilConditionCompacted',sandy:'soilConditionSandy',clay:'soilConditionClay',unknown:'soilConditionUnknown',
  vegetables:'cropVegetables','fruit-trees':'cropFruitTrees',herbs:'cropHerbsMedicinal',indigenous:'cropIndigenousPlants',fodder:'cropFodder',grain:'cropGrainMaize',nothing:'cropNothing',
  chickens:'livestockChickens',goats:'livestockGoats',cattle:'livestockCattle',pigs:'livestockPigs',bees:'livestockBees',
  compost:'soilAmendmentCompost','kraal-manure':'soilAmendmentKraalManure',mulch:'soilAmendmentMulch','commercial-fert':'soilAmendmentCommercialFert',
  'shade-tunnel':'infraShadeTunnel',greenhouse:'infraGreenhouse','compost-bay':'infraCompostBay',shed:'infraStorageShed',kraal:'infraLivestockKraal',
  organic:'practiceFullyOrganicLabel','mostly-organic':'practiceMostlyOrganicLabel',conventional:'practiceConventionalLabel',experimenting:'practiceExperimentingLabel',
  'farm-stall':'marketFarmStall','local-market':'marketLocalCommunity',wholesale:'marketWholesale','not-sure':'marketNotSure',
  drought:'challengeDrought',pests:'challengePests',water:'challengeLimitedWater',funding:'challengeFunding',labour:'challengeLabour',flooding:'challengeFlooding',market:'challengeMarket',
};

export default function SiteSurveyReview({ survey:s, onEdit, onEditProduction, productionLabels, months }: {
  survey:SiteSurvey; onEdit:(step:number)=>void; onEditProduction:()=>void;
  productionLabels:Array<{category:ProductionCategory;label:string}>; months:string[];
}) {
  const {lang,t}=useLanguage();
  const unknown=t('surveyNotRecorded');
  const list=(values:string[], overrides:Record<string,string>={})=>values.length?values.map(v=>t(overrides[v]??LABELS[v]??(v==='none'?'surveyNoneReported':v))).join(' · '):unknown;
  const challengeSources:Record<string,string>={drought:'Drought / dry spells',pests:'Pests & disease',soil:'Poor / degraded soil',water:'Limited water access',funding:'Funding / costs',labour:'Not enough labour',flooding:'Flooding / erosion',market:'Market access',none:'No major challenges'};
  const practiceSources:Record<string,string>={organic:'Fully organic','mostly-organic':'Mostly organic',conventional:'Conventional',experimenting:'Experimenting / mixed'};
  const paired=(key:string,english:string)=>lang==='zu'?<SurveyZuluDraftPair english={english}>{t(key)}</SurveyZuluDraftPair>:t(key);
  const challengeList=(values:string[])=>values.length?values.map(value=>{
    const key=value==='none'?'challengeNone':LABELS[value]??value;
    const english=challengeSources[value];
    return english?paired(key,english):t(key);
  }).reduce<ReactNode[]>((items,item,index)=>index? [...items,' · ',item]:[item],[]):unknown;
  const area=(n:number|null)=>n===null?unknown:`${numberLabel(n)} m²`;
  const editSectionName=(step:number,title:ReactNode):string=>step===6
    ?lang==='zu'?'Izinselelo (Challenges & Priorities)':'Challenges & Priorities'
    :typeof title==='string'?title:'Challenges & Priorities';
  const entries=s.reportedProduction??[];
  const harvestMonths=new Set(entries.flatMap(row=>row.harvestMonths??[]));
  const sections=[
    {step:0,Icon:Users,title:t('surveyStepHouseholdInfo'),rows:[
      [t('sectionWhoIsThisSiteFor'),t(s.siteType==='community'?'radioCommunityGroup':'radioMeMyFamily')],
      [t(s.siteType==='community'?'sectionApproximateNumberOfMembers':'sectionAdultsWhoWorkThisLand'),(s.siteType==='community'?s.memberCount:s.adults)||unknown],
      [t('sectionGoalsSelectAll'),list(s.goals,{soil:'goalRestoreTheLandLabel'})],
    ]},
    {step:1,Icon:Leaf,title:t('surveyStepLandLocation'),rows:[
      [t('sectionSoilCondition'),list(s.soilCondition?[s.soilCondition]:[])],
      [t('sectionHowIsLandPrepared'),list(s.landPrepMethod?[s.landPrepMethod]:[])],
      [t('sectionSoilInputs'),list(s.soilAmendments)],
      [t('sectionFencing'),s.hasFencing?t({full:'fencingFull',partial:'fencingPartial',none:'fencingNone'}[s.hasFencing]??s.hasFencing):unknown],
    ]},
    {step:2,Icon:Sprout,title:t('surveyGrowingResources'),rows:[
      [t('sectionCropsGrowing'),list(s.existingCrops)],
      [t('surveyExistingGrowingAreaLabel'),area(s.existingGrowingAreaM2),s.existingGrowingAreaM2===null?'':t(s.existingGrowingAreaSource==='auto'?'surveySourceMap':'surveySourceFarmer')],
    ]},
    {step:3,Icon:Sprout,title:t('surveyStepLivestockPoultry'),rows:[[t('sectionLivestock'),list(s.livestock)],[t('sectionOtherInfrastructure'),list(s.otherInfra)]]},
    {step:4,Icon:Users,title:t('surveyStepIncomeSales'),rows:[[t('toggleSellProduceLabel'),t(s.isCommercial?'surveyAnswerYes':'surveyAnswerNo')],[t('sectionCurrentOrTargetMarket'),s.isCommercial?list(s.marketType?[s.marketType]:[]):t('surveyNotApplicable')]]},
    {step:5,Icon:Droplets,title:t('surveyStepResourcesInputs'),rows:[
      [t('sectionWaterSources'),list(s.waterSource)],
      [t('sectionHowDoesWaterReachPlants'),list(s.waterDelivery)],
      [t('sectionWaterStorage'),list(s.waterStorage)],
      [t('toggleGuttersLabel'),t(s.hasGutters?'surveyAnswerYes':'surveyAnswerNo')],
      [t('sectionMainBuildingRoofArea'),area(s.roofMainM2),s.roofMainM2===null?'':t(s.roofAreaSource==='auto'?'surveySourceMap':'surveySourceFarmer')],
      [t('sectionSecondaryRoofs'),area(s.roofSecondaryM2),s.roofSecondaryM2===null?'':t(s.roofSecondarySource==='auto'?'surveySourceMap':'surveySourceFarmer')],
    ]},
    {step:6,Icon:AlertTriangle,title:paired('stepChallenges','Challenges & Priorities'),rows:[
      [paired('sectionFarmingApproach','Farming approach'),s.farmingPractice?paired(LABELS[s.farmingPractice]??s.farmingPractice,practiceSources[s.farmingPractice]??s.farmingPractice):unknown],
      [paired('sectionMainChallenges','Main challenges on this site (select at least one)'),challengeList(s.challenges)],
      [paired('sectionAnythingElseLimaShouldKnow','Anything else Lima should know?'),s.notes.trim()||unknown],
    ]},
  ];
  return <>
    <div className={styles.reviewIntro}><ClipboardCheck size={30}/><div><h3>{t('surveyYourSiteAtGlance')}</h3><p>{lang === 'zu' ? <SurveyZuluDraftPair english="These are your recorded observations. Blank fields remain unknown. Save to make these answers available to your site report.">{t('surveyReviewBasis')}</SurveyZuluDraftPair> : t('surveyReviewBasis')}</p></div></div>
    <div className={styles.reviewGrid}>{sections.map(({step,Icon,title,rows})=><section key={step} className={styles.reviewCard}>
      <header><Icon size={19}/><h3>{title}</h3><button aria-label={`${t('surveyEditSection')}: ${editSectionName(step,title)}`} onClick={()=>onEdit(step)}><Pencil size={16}/></button></header>
      <dl>{rows.map(([label,value,source],rowIndex)=><div key={`${step}-${rowIndex}`}><dt>{label}</dt><dd>{value}{source&&<small>{source}</small>}</dd></div>)}</dl>
    </section>)}</div>
    <section className={styles.harvest}>
      <h3>{t('surveyHarvestOverview')}</h3><p>{lang === 'zu' ? <SurveyZuluDraftPair english="A tick means you recorded a harvest in that month. An empty month means timing is not recorded; it does not mean a food gap.">{t('surveyHarvestUnknown')}</SurveyZuluDraftPair> : t('surveyHarvestUnknown')}</p>
      <div className={styles.months}>{months.map((month,i)=><span key={month} data-reported={harvestMonths.has(i+1)} aria-label={`${month}: ${t(harvestMonths.has(i+1)?'surveyHarvestReported':'surveyNotRecorded')}`}>{harvestMonths.has(i+1)?<Check size={15}/>:<Circle size={15}/>} {month}</span>)}</div>
      <div className={styles.reviewProduction}>{entries.length===0?<p className={styles.smallNote}>{t('surveyNoProductionYet')}</p>:entries.map(row=><article key={row.category}>
        <div><strong>{row.name||productionLabels.find(item=>item.category===row.category)?.label}</strong><span>{row.quantityPerYear===null?unknown:`${numberLabel(row.quantityPerYear)} ${row.unit} / ${t('surveyPerYear')}`}</span></div>
        <p>{t('surveyUsedByHouseholdLabel')}: {row.usedByHousehold===null?unknown:`${row.usedByHousehold} ${row.unit}`} · {t('surveySoldLabel')}: {row.sold===null?unknown:`${row.sold} ${row.unit}`}<br/>{t('surveyIncomeEarnedLabel')}: {row.incomeZar===null?unknown:`R ${numberLabel(row.incomeZar)}`}</p>
      </article>)}</div>
      <button className={styles.detailLink} onClick={onEditProduction}><Pencil size={16}/>{t('surveyEditProduction')}</button>
    </section>
  </>;
}
