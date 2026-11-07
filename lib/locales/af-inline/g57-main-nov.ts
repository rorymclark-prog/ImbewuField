// Unreviewed Afrikaans machine drafts keyed by the exact English (see index.ts).
// What the 6 Nov 2026 merge of main added: the Assistant connections page (app/connect/imbewu), the registration-preview
// figure it embeds, and the Settings link to it. Mirrors the isiXhosa shard g55-main-nov.ts key for key. The update guide and
// its illustrated walkthrough stay English here: a module-stub harness compiles them without a draft-language lookup (their
// release-note and tour wording is in update-copy-locales/af.ts).
const drafts: Record<string, string> = {
  // Assistant connections page (its title and the Settings link reuse the g29 draft of "Assistant connections").
  "Back to Account": "Terug na Rekening",
  "Work with your saved sites through an assistant. Choose which sites it may use and disconnect it here whenever you need to.": "Werk met jou gestoorde terreine deur 'n assistent. Kies watter terreine dit mag gebruik en ontkoppel dit hier wanneer jy ook al nodig het.",
  "Checking your account…": "Kontroleer tans jou rekening…",
  "Sign in to your ImbewuField account": "Meld aan by jou ImbewuField-rekening",
  "Your assistant receives its own scoped connection. It does not receive your password.": "Jou assistent kry sy eie beperkte verbinding. Dit kry nie jou wagwoord nie.",
  "Continue with Google": "Gaan voort met Google",
  "Password": "Wagwoord",
  "Loading your sites and connections…": "Laai tans jou terreine en verbindings…",
  "Your account": "Jou rekening",
  "Personal account": "Persoonlike rekening",
  "Connect {name}": "Koppel {name}",
  "After you approve, return to": "Nadat jy goedkeur, keer terug na",
  "Only continue if you started this connection and recognise that destination.": "Gaan net voort as jy hierdie verbinding begin het en die bestemming herken.",
  "Choose sites to share with this assistant": "Kies terreine om met hierdie assistent te deel",
  "No saved sites are synced to this account yet. You may connect with no sites, then save a site in the app and reconnect to select it.": "Nog geen gestoorde terreine is met hierdie rekening gesinkroniseer nie. Jy kan sonder terreine koppel, dan 'n terrein in die toepassing stoor en weer koppel om dit te kies.",
  "This does not grant access to your Gmail, Drive or computer. New sites need a new connection decision. Connections expire after 90 days; access tokens last one hour.": "Dit gee nie toegang tot jou Gmail, Drive of rekenaar nie. Nuwe terreine het 'n nuwe verbindingsbesluit nodig. Verbindings verval ná 90 dae; toegangstekens hou een uur.",
  "Allow selected access": "Laat gekose toegang toe",
  "Cancel connection": "Kanselleer verbinding",
  "Connected assistants": "Gekoppelde assistente",
  "{n} selected sites · expires {date}": "{n} gekose terreine · verval op {date}",
  "Disconnect {name}": "Ontkoppel {name}",
  "No active assistant connections.": "Geen aktiewe assistentverbindings nie.",
  "Site originals": "Terrein-oorspronklikes",
  "Imported originals keep their source, byte count and fingerprint. They are separate from the small evidence thumbnails stored on a device.": "Ingevoerde oorspronklikes behou hul bron, greeptelling en vingerafdruk. Hulle is apart van die klein bewysduimnaels wat op 'n toestel gestoor word.",
  "Completed imports remain in ImbewuField after the chat closes.": "Voltooide invoere bly in ImbewuField nadat die klets gesluit is.",
  "{size} bytes · {mime}": "{size} grepe · {mime}",
  "Import authorisation: {authorisation}": "Invoermagtiging: {authorisation}",
  "Open original {name}": "Maak oorspronklike {name} oop",
  "No originals are attached to this site.": "Geen oorspronklikes is aan hierdie terrein geheg nie.",
  "Historical photo registration draft": "Konsep vir passing van historiese foto",
  "Review registered photograph": "Hersien die gepaste foto",
  "{name} · Original bytes verified": "{name} · Oorspronklike grepe geverifieer",
  "Connect an MCP-compatible assistant": "Koppel 'n MCP-versoenbare assistent",
  "Use the ImbewuField private plugin, or add the following Streamable HTTP endpoint in a host that supports OAuth and remote MCP:": "Gebruik die private ImbewuField-inprop, of voeg die volgende Streamable HTTP-eindpunt by in 'n gasheer wat OAuth en afstand-MCP ondersteun:",
  "Your host should open this app’s sign-in and site-selection page. An installed plugin card alone does not mean the connection is authenticated.": "Jou gasheer moet hierdie toepassing se aanmeld- en terreinkiesbladsy oopmaak. 'n Geïnstalleerde inpropkaart alleen beteken nie die verbinding is geverifieer nie.",
  // Registration-preview figure.
  "Photo preview is unavailable on this device.": "Fotovoorskou is nie op hierdie toestel beskikbaar nie.",
  "The original photo could not be displayed.": "Die oorspronklike foto kon nie gewys word nie.",
  "Registered original photograph with saved design outlines and observed control points": "Gepaste oorspronklike foto met gestoorde ontwerpomtrekke en waargenome beheerpunte",
  "Matching error: {rms} pixels RMS; {max} pixels maximum.": "Passingsfout: {rms} piksels RMS; {max} piksels maksimum.",
  "White circles mark matched controls. Green outlines show the saved design. Empty ground stays blank.": "Wit sirkels merk gepaste beheerpunte. Groen omtrekke wys die gestoorde ontwerp. Leë grond bly leeg.",
  "Needs visual review · Your current maps and saved geometry are unchanged.": "Moet visueel nagegaan word · Jou huidige kaarte en gestoorde meetkunde is onveranderd.",
};
export default drafts;
