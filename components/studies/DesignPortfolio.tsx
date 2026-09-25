"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { PORTFOLIO_STAGES, PORTFOLIO_LIMIT, PORTFOLIO_NOTICE, portfolioStorageKey, portfolioText, readPortfolio, type PortfolioAnswers } from '@/lib/design-portfolio';
import OfflinePageLink from './OfflinePageLink';
import DesignDraftCopy from './DesignDraftCopy';
import styles from './FinanceCourse.module.css';
import folder from './DesignPortfolio.module.css';

type Draft = { key: string; answers: PortfolioAnswers; baseline: string | null; loadError: boolean; dirty: boolean };

const STAGE_ZU: Record<string, { title: string; purpose: string }> = {
  d1: { title: 'Abantu, indawo nobufakazi', purpose: 'Vumelanani ngomsebenzi ngaphambi kokudweba isisombululo.' },
  d2: { title: 'Amaphethini nemibuzo yokuklama', purpose: 'Chaza ukuthi ubufakazi busho ukuthini ekudizayineni.' },
  d3: { title: 'Ezinye izindlela nokukhetha okunezizathu', purpose: 'Qhathanisa izindlela zokufeza izidingo ezifanayo.' },
  d4: { title: 'Uhlelo olungahlolwa', purpose: 'Bonisa ukuthi yini elingana, exhumene nokungakaxazululwa.' },
  d5: { title: 'Umsebenzi, imali nokunakekela okuqhubekayo', purpose: 'Xhumanisa umdwebo nomsebenzi ongafezeka nezibopho okuvunyelwene ngazo.' },
  d6: { title: 'Impendulo, ukuqapha nokubuyekeza', purpose: 'Chaza umklamo bese uqhubeka uwuthuthukisa usebenzisa izidingo zokuqala.' },
};
const FIELD_ZU: Record<string, { label: string; prompt: string }> = {
  brief: { label: 'Yini ebalulekile emzini?', prompt: 'Rekhoda izidingo okuvunyelwene ngazo, ukuthi ubani osebenzisa futhi onakekela indawo, nokuthi yini okufanele iqhubeke isebenza. Bhala okungaphandle kwalesi sigaba. Ungasebenzisa izindima noma izinhlamvu zokuqala zamagama.' },
  evidence: { label: 'Wazini, futhi ukutholephi?', prompt: 'Nikeza inothi ngalinye ireferensi. Faka usuku, umthombo nokuthi kubonwe, kwabikwa, kukalwe noma kuphakanyisiwe yini. Rekhoda imikhawulo, ukungavumelani nemvume yokusebenzisa ulwazi lomuntu.' },
  base: { label: 'Iyiphi imephu eyisisekelo nezilinganiso ozisebenzisayo?', prompt: 'Rekhoda igama lomdwebo nenguqulo yawo. Gcina izici ezikhona, indlela yokungena, isimo somngcele, ukuqondiswa, amayunithi nendlela yokulinganisa kuhlangene nawo. Bhala izilinganiso ezingekho. Gcina umdwebo wangempela ngokwehlukile kule folda.' },
  patterns: { label: 'Imaphi amaphethini athinta uhlelo?', prompt: 'Bhekisela ebufakazini ngokuhamba, amanzi, umthunzi, izinkathi zonyaka, umhlabathi nokuchayeka. Hlukanisa izikhathi zokusetshenziswa emithonyeni yangaphandle. Ungathathi ukuvakashela okukodwa njengobufakazi bephethini yesizini.' },
  questions: { label: 'Yiziphi izinqumo ezidinga ukuphenywa?', prompt: 'Guqula okuqaphele waba imibuzo. Chaza ukuthi umbuzo ngamunye usiza izidingo zikabani nokuthi yiziphi izindlela ezisavuliwe.' },
  checks: { label: 'Yini okufanele ihlolwe ngokulandelayo?', prompt: 'Yisho ubufakazi obungekho, indlela efanele yokubuthola, ukuthi ubani ongasiza nokuthi yisiphi isinqumo esincike kubo. Shiya umsebenzi ongaphephile noma odinga uchwepheshe kulabo abafanele.' },
  connections: { label: 'Ingxenye ngayinye ehlongozwayo idingani futhi inikani?', prompt: 'Landela amanzi, izinto zokwakha, abantu nokunakekela phakathi kwezici. Thola ukuxhumana okuwusizo nokungqubuzana okungenzeka. Ungacabangi ukuthi okukhiqizwayo kufanele izidingo zenye ingxenye ungakahloli.' },
  alternatives: { label: 'Izindlela ozicabangelayo ziqhathaniseka kanjani?', prompt: 'Yisho amashidi emidwebo yezinye izindlela. Ziqhathanise nezidingo ezifanayo zomuzi, ukufinyelela, ukunakekela, amanzi nezindleko. Faka nokuqhubeka nesimo samanje noma ukuhlehlisa umsebenzi lapho kufanele.' },
  choice: { label: 'Iyiphi indlela ozoyiphenya noma oyithuthukise, futhi kungani?', prompt: 'Nikeza ubufakazi obusekela ukukhetha kwakho, ukulahlekelwa nokuzuza okusekhona, izinto ezingaziwa nokuthi yini engashintsha umqondo wakho. Ukukhetha kwesikhashana akuyona imvume yokwakha.' },
  plans: { label: 'Yimiphi imidwebo ebonisa isiphakamiso esithuthukisiwe?', prompt: 'Bhala imephu eyisisekelo, ukuhlaziywa, isiphakamiso nemidwebo yemininingwane kanye nenguqulo, isimo sesikali, amayunithi, ukhiye nemithombo. Bhekisela kumafayela angempela noma emashidini ephepha; ukubhala amagama awo lapha akuwanamathiseli.' },
  fit: { label: 'Ukuhambisana nokufinyelela ukuhlole kanjani?', prompt: 'Khomba izilinganiso ezihloliwe nemithombo yobuchwepheshe efanele oyisebenzisile. Chaza ukuthi uwuhlole kanjani umdwebo nekhophi ekhishiwe. Rekhoda ukuhlolwa kokufundeka nomunye umuntu nanoma yikuphi ukulungisa.' },
  dependencies: { label: 'Yimuphi umsebenzi oncike kwezinye izinto noma omisiwe?', prompt: 'Bhala imibuzo engakaxazululwa ngamanzi, umhlabathi, ukufinyelela, ubuchwepheshe noma izimvume. Chaza imiphumela kwezinye izigaba nobufakazi noma iseluleko esidingekayo ngaphambi kokuba umsebenzi othintekayo uqhubeke.' },
  sequence: { label: 'Yini okufanele yenzeke kuqala?', prompt: 'Bhala izigaba, izimfuneko zazo nokuthi ubani ovumayo ukuthi isigaba sesilungele. Faka ukuhlola okufanele kwenziwe ngaphambi kokusebenzisa imali noma ukuqala umsebenzi. Shiya kumisiwe izinto ezisenezimfuneko ezingakaxazululwa.' },
  costs: { label: 'Isigaba ngasinye sizodinga ziphi izinsiza nemali?', prompt: 'Sebenzisa izinkomba zezici ezifanayo nalezo ezisemidwebeni. Rekhoda amanani akaliwe, izinombolo zamakhotheshini, izinsuku nokuthi imali idingeka nini. Maka izilinganiso nezindleko ezingekho. Bhekisela ekhasini lakho lezezimali; ungaguquli okungaziwa kube uziro.' },
  care: { label: 'Ubani ovumile ukunakekela uhlelo?', prompt: 'Chaza imisebenzi, izindima okuvunyelwene ngazo, isikhathi nezinto ezitholakalayo, nokuthi kwenzekani uma amanzi, imali noma umnakekeli ojwayelekile engatholakali. Rekhoda isivumelwano kunokuba unikeze omunye umsebenzi wakhe ngaphandle kokumbuza.' },
  presentation: { label: 'Uthini umuzi noma umbuyekezi?', prompt: 'Rekhoda usuku, indima yombuyekezi, inguqulo yomdwebo okuxoxwe ngayo, lokho akuqondayo nalokho okudinga ukuzanywa futhi. Chaza ukuthi izinqumo zakho ziphendula kanjani izidingo zokuqala.' },
  monitoring: { label: 'Uzokwazi kanjani ukuthi kuyasebenza?', prompt: 'Khetha okuqaphelwayo okuhlobene nezidingo zomuzi. Rekhoda ubufakazi bokuqala, ovumayo ukuqapha, isikhathi noma isenzakalo esilandelayo, nokuthi yini engabangela ukubuyekeza. Ungaqambi imiphumela.' },
  revision: { label: 'Yini eshintshile, kungani, futhi yisiphi isinyathelo esilandelayo?', prompt: 'Gcina inguqulo yangaphambilini. Khomba ubufakazi noma impendulo entsha, isinqumo esishintshile nomdwebo, izindleko noma amarekhodi okunakekela athintekayo. Rekhoda ukuhlola okusasele nokubuyekeza okulandelayo.' },
};
const STATUS_ZU: Record<string, string> = {
  'Your folder is empty. Save your notes before leaving.': 'Ifolda yakho ayinalutho. Londoloza amanothi akho ngaphambi kokuphuma.',
  'Opened the saved folder for this device.': 'Ifolda elondolozwe kule divayisi ivuliwe.',
  'The saved folder could not be opened. Its stored copy has not been replaced. You can write here and download a text copy.': 'Ifolda elondoloziwe ayikwazanga ukuvulwa. Ikhophi egciniwe ayishintshwanga. Ungabhala lapha bese ulanda ikhophi yombhalo.',
  'Keep this work by downloading a text copy. The unreadable stored draft is protected.': 'Gcina lo msebenzi ngokulanda ikhophi yombhalo. Uhlaka olugciniwe olungafundeki luvikelekile.',
  'You have notes to save. Save before following another lesson link.': 'Unamanothi okufanele uwalondoloze. Londoloza ngaphambi kokulandela isixhumanisi sesinye isifundo.',
  'This saved folder changed in another tab. Download your current notes before reopening the saved folder. This page has not overwritten it.': 'Le folda elondoloziwe ishintshile kwenye ithebhu. Landa amanothi akho amanje ngaphambi kokuvula kabusha ifolda egciniwe. Leli khasi alizange liyibhale phezu kwayo.',
  'Saved for this sample session. Download a copy before ending the session.': 'Kulondolozwe kulesi sikhathi sesibonelo. Landa ikhophi ngaphambi kokuqeda isikhathi.',
  'Saved on this device. Not uploaded or submitted.': 'Kulondolozwe kule divayisi. Akulayishwanga noma kuthunyelwe.',
  'This device could not save the folder. Keep this page open and download a text copy.': 'Le divayisi ayikwazanga ukulondoloza ifolda. Gcina leli khasi livuliwe bese ulanda ikhophi yombhalo.',
  'Text copy requested. Check your Downloads for imbewu-design-learning-folder.txt. The drawing files are separate.': 'Kucelwe ikhophi yombhalo. Hlola kufolda ethi Downloads ukuthi ikhona yini i-imbewu-design-learning-folder.txt. Amafayela emidwebo ahlukile.',
  'Opening your design folder…': 'Kuvulwa ifolda yakho yokuklama…',
};

export default function DesignPortfolio() {
  const { lang } = useLanguage();
  const { user, loading } = useAuth();
  const [sample, setSample] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => setSample(isSampleMode());
    update(); window.addEventListener(SAMPLE_MODE_EVENT, update);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, update);
  }, []);
  const key = portfolioStorageKey(user?.uid ?? null, sample === true);
  useEffect(() => {
    if (loading || sample === null) return;
    try {
      const raw = localStorage.getItem(key);
      setDraft({ key, answers: readPortfolio(raw), baseline: raw, loadError: false, dirty: false });
      setMessage(raw === null ? 'Your folder is empty. Save your notes before leaving.' : 'Opened the saved folder for this device.');
    } catch {
      setDraft({ key, answers: {}, baseline: null, loadError: true, dirty: false });
      setMessage('The saved folder could not be opened. Its stored copy has not been replaced. You can write here and download a text copy.');
    }
  }, [key, loading, sample]);
  const ready = !loading && sample !== null && draft?.key === key;
  const answers = ready ? draft.answers : {};
  const statusCopy = (message: string) => {
    const zu = STATUS_ZU[message];
    return lang === 'zu' && zu ? <DesignDraftCopy en={message} zu={zu} /> : message;
  };
  useEffect(() => {
    if (!ready || !draft.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ready, draft]);
  function change(id: string, value: string) {
    if (!ready) return;
    setDraft({ ...draft, answers: { ...answers, [id]: value }, dirty: true });
    setMessage(draft.loadError ? 'Keep this work by downloading a text copy. The unreadable stored draft is protected.' : 'You have notes to save. Save before following another lesson link.');
  }
  function save() {
    if (!ready || draft.loadError) return;
    try {
      // Another open tab may hold newer work. Keep both copies instead of overwriting it unnoticed.
      if (localStorage.getItem(key) !== draft.baseline) {
        setMessage('This saved folder changed in another tab. Download your current notes before reopening the saved folder. This page has not overwritten it.');
        return;
      }
      const raw = JSON.stringify({ version: 1, answers });
      localStorage.setItem(key, raw);
      setDraft({ ...draft, baseline: raw, dirty: false });
      setMessage(sample ? 'Saved for this sample session. Download a copy before ending the session.' : 'Saved on this device. Not uploaded or submitted.');
    } catch { setMessage('This device could not save the folder. Keep this page open and download a text copy.'); }
  }
  function download() {
    if (!ready) return;
    const url = URL.createObjectURL(new Blob([portfolioText(answers)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'imbewu-design-learning-folder.txt';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Text copy requested. Check your Downloads for imbewu-design-learning-folder.txt. The drawing files are separate.');
  }
  return <>
    <aside className={`${styles.notice} ${styles.projectNotice}`}><p><DesignDraftCopy en={PORTFOLIO_NOTICE} zu="Ifolda yokufunda ukuklama — isifundo esiboniswa ngesiNgisi. Amanothi awasona isivivinyo esithunyelwe, ukuhlolwa kwendawo okuqinisekisiwe noma imvume yokusebenzisa uhlelo. Gcina imidwebo yangempela nobufakazi kanye naleli rekhodi." /></p></aside>
    <section className={styles.section}>
      <h2><DesignDraftCopy en="One folder, from brief to revision" zu="Ifolda eyodwa, kusukela encazelweni kuya ekubuyekezeni" /></h2>
      <p><DesignDraftCopy en="Use this beside your drawings, or work on paper. Read out your answers while a learning partner writes if that helps. Use a practice site or a short site label; private household details are not needed here." zu="Sebenzisa lokhu kanye nemidwebo yakho, noma ubhale ephepheni. Uma kusiza, funda izimpendulo zakho uzakwenu wokufunda azibhale. Sebenzisa indawo yokuzilolonga noma ilebula emfushane yendawo; akudingeki ufake imininingwane yangasese yomuzi." /></p>
      <p><DesignDraftCopy en="Saving keeps one folder for this account on this browser and device. It does not sync to another device. Guest notes are shared by people using this browser. Download a text copy to keep with your drawings, and save before leaving this page." zu="Ukulondoloza kugcina ifolda eyodwa yale akhawunti kule browser nakule divayisi. Ayivumelaniswa nenye idivayisi. Amanothi esivakashi abiwa ngabantu abasebenzisa le browser. Landa ikhophi yombhalo ukuze uyigcine nemidwebo yakho, bese ulondoloza ngaphambi kokuphuma kuleli khasi." /></p>
      <nav className={folder.stageLinks} aria-label="Design folder stages">{PORTFOLIO_STAGES.map((stage, index) => <a key={stage.id} href={`#folder-${stage.id}`}><span>{index + 1}</span><DesignDraftCopy en={stage.title} zu={STAGE_ZU[stage.id].title} /></a>)}</nav>
    </section>
    {!ready && <p role="status">{statusCopy('Opening your design folder…')}</p>}
    {PORTFOLIO_STAGES.map((stage, index) => <section className={`${styles.section} ${folder.stage}`} id={`folder-${stage.id}`} key={stage.id}>
      <p className={styles.eyebrow}><DesignDraftCopy en={`Stage ${index + 1} · Your design evidence`} zu={`Isigaba ${index + 1} · Ubufakazi bomklamo wakho`} /></p>
      <h2><DesignDraftCopy en={stage.title} zu={STAGE_ZU[stage.id].title} /></h2><p><DesignDraftCopy en={stage.purpose} zu={STAGE_ZU[stage.id].purpose} /></p>
      <details className={folder.example}><summary><DesignDraftCopy en="Discuss the busy-yard example" zu="Xoxani ngesibonelo segceke elimatasa" /></summary><p>{stage.example}</p></details>
      {stage.fields.map(field => <div className={styles.answerField} key={field.id}>
        <label htmlFor={`portfolio-${field.id}`}><strong><DesignDraftCopy en={field.label} zu={FIELD_ZU[field.id].label} /></strong></label>
        <span id={`help-${field.id}`}><DesignDraftCopy en={field.prompt} zu={FIELD_ZU[field.id].prompt} /></span>
        <textarea id={`portfolio-${field.id}`} aria-describedby={`help-${field.id}`} disabled={!ready} rows={5} maxLength={PORTFOLIO_LIMIT} value={answers[field.id] ?? ''} onChange={event => change(field.id, event.target.value)} />
        {(answers[field.id]?.length ?? 0) > PORTFOLIO_LIMIT - 500 && <span><DesignDraftCopy en={`${PORTFOLIO_LIMIT - (answers[field.id]?.length ?? 0)} characters remaining. Keep longer evidence in a separate document and reference it here.`} zu={`${PORTFOLIO_LIMIT - (answers[field.id]?.length ?? 0)} izinhlamvu ezisele. Gcina ubufakazi obude kudokhumenti ehlukile bese ubhekisela kubo lapha.`} /></span>}
        <p className={folder.printAnswer}>{answers[field.id] || <DesignDraftCopy en="[Not yet recorded]" zu="[Akukarekhodwa]" />}</p>
      </div>)}
      <aside className={folder.review}><h3><DesignDraftCopy en="Review the reasoning together" zu="Buyekeza indlela yokucabanga ndawonye" /></h3><p>{stage.review}</p><p>Discuss what is supported, what needs more evidence and the next attempt. Record feedback and changes in stage 6.</p></aside>
      <div className={styles.actions}><button type="button" disabled={!ready || draft.loadError} onClick={save}><DesignDraftCopy en="Save folder after this stage" zu="Londoloza ifolda ngemva kwalesi sigaba" /></button><OfflinePageLink href={`/student/design/${stage.lesson}`}><DesignDraftCopy en="Revisit this stage’s lessons →" zu="Buyekeza izifundo zalesi sigaba →" /></OfflinePageLink>{stage.id === 'd4' && <OfflinePageLink href="/student/guides/design">Design Studio guide →</OfflinePageLink>}{stage.id === 'd5' && <OfflinePageLink href="/student/finance">Farm Finance →</OfflinePageLink>}</div><p className={folder.saveNote}>{ready ? statusCopy(message) : statusCopy('Opening your design folder…')}</p>
    </section>)}
    <section className={styles.section}><h2><DesignDraftCopy en="Bring the folder and the actual plan" zu="Letha ifolda nohlelo lwangempela" /></h2><p>A reviewer needs the evidence notes, drawings and your explanation together. Check that each reference names the right revision. Explain an alternative you rejected, a decision still on hold and what could make you revise the plan.</p><p><DesignDraftCopy en="This page does not grade your answers or approve a design. Your facilitator reviews what you can explain and demonstrate, then helps identify the next attempt." zu="Leli khasi aliwabeki amamaki ezimpendulweni zakho futhi alivumi umklamo. Umgqugquzeli uhlola lokho ongakuchaza nokukubonisa, bese esiza ekutholeni umzamo olandelayo." /></p></section>
    <div className={folder.saveBar}>
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={!ready || draft.loadError} onClick={save}><DesignDraftCopy en="Save folder on this device" zu="Londoloza ifolda kule divayisi" /></button><button type="button" disabled={!ready} onClick={download}><DesignDraftCopy en="Download my folder as text" zu="Landa ifolda yami njengombhalo" /></button></div>
      <p role="status">{ready ? statusCopy(message) : statusCopy('Opening your design folder…')}</p>
    </div>
  </>;
}
