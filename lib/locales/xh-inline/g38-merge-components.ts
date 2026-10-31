// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
const drafts: Record<string, string> = {
  // components/AccountAccess.tsx — main now passes the separator inside the English.
  " · linked to an organisation": " · ixhunyiwe kumbutho",
  " · no organisation linked": " · akukho mbutho uxhunyiweyo",
  // components/ConsentPanel.tsx + components/PopiaConsent.tsx — consent draft notice.
  "Unreviewed consent translation. Read the English source before choosing or agreeing.": "Uguqulelo lwemvume olungekahlolwa. Funda umthombo wesiNgesi phambi kokuba ukhethe okanye uvume.",
  // components/ConsentPanel.tsx — {organisation} is "ngu-<name>" (the agent) for isiXhosa.
  "Nothing here is shared unless you switch it on. You can change your mind at any time, and {organisation} will stop seeing it straight away.": "Akukho nto yabelwanayo apha ngaphandle kokuba uyivule. Unokutshintsha ingqondo yakho nanini na, kwaye kwangoko ayisayi kuphinda ibonwe {organisation}.",
  "You are sharing {count} of {total} things.": "Wabelana ngezinto ezi-{count} kwezi-{total}.",
  // components/PhotoViewer.tsx — the sample label is now its own string.
  "Illustration": "Umzobo",
};

export default drafts;
