'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Trash2, FileText, AlertTriangle } from 'lucide-react';
import type { EvidenceCatalogueGroup, EvidenceCatalogueItem } from '@/lib/evidence-catalogue';
import { EVIDENCE_GROUP_ICON, QUICK_NUMBERS, LIMA_TIPS } from '@/lib/evidence-catalogue';
import { evidenceDocumentScope, saveEvidenceDocument, loadEvidenceDocument, removeEvidenceDocument } from '@/lib/evidence-documents';
import {
  getEvidenceItems,
  addEvidenceItem,
  removeEvidenceItem,
  getQuickNumbers,
  setQuickNumber,
  resizeForStorage,
  type EvidenceItem,
} from '@/lib/site-evidence';

interface Props {
  siteId: string;
  group: EvidenceCatalogueGroup;
  item?: EvidenceCatalogueItem;
  onClose: () => void;
  onChanged: () => void;
}

export default function EvidenceSheet({ siteId, group, item, onClose, onChanged }: Props) {
  const itemKey = item ? `${group.key}_${item.key}` : `${group.key}_site_photos`;
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [quickNums, setQuickNums] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [storageFull, setStorageFull] = useState(false);
  const [fileError, setFileError] = useState('');
  const [resultNote, setResultNote] = useState('');
  const isLab = item?.key === 'lab_result' && (group.key === 'soil' || group.key === 'water');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickFields = QUICK_NUMBERS[group.key] ?? [];
  const limaTip = LIMA_TIPS[group.key];
  const groupLabel = item?.label ?? group.label;
  const groupDesc = group.key === 'land_legal'
    ? 'Documents that prove your right to farm this land'
    : item?.docOnly
    ? 'PDFs, scans and test reports'
    : group.key === 'water'
    ? 'Borehole tests, usage & municipal bills'
    : group.key === 'trees'
    ? 'Snap canopy first, then base & trunk'
    : 'Photos, scans and documents';

  useEffect(() => {
    setEvidenceItems(getEvidenceItems(siteId, itemKey));
    setQuickNums(getQuickNumbers(siteId, group.key));
  }, [siteId, itemKey, group.key]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setStorageFull(false);
    setFileError('');
    const scope = evidenceDocumentScope(siteId);
    for (const file of Array.from(files)) {
      try {
        if (isLab && getEvidenceItems(siteId,itemKey).length >= 4) throw Error('This test folder holds four entries. Remove an older entry before adding another.');
        let saved: boolean;
        if (file.type.startsWith('image/')) {
          const dataUrl = await resizeForStorage(file);
          if (scope !== evidenceDocumentScope(siteId)) throw Error('The account or sample changed. Reopen the upload.');
          saved = addEvidenceItem(siteId, itemKey, { type: 'photo', dataUrl, name: file.name, sizeBytes: file.size });
        } else if (isLab) {
          const documentId = await saveEvidenceDocument(scope, file);
          if (scope !== evidenceDocumentScope(siteId)) { await removeEvidenceDocument(scope, documentId); throw Error('The account or sample changed. Reopen the upload.'); }
          saved = addEvidenceItem(siteId, itemKey, { type:'pdf', name:file.name, sizeBytes:file.size, documentId });
          if (!saved) await removeEvidenceDocument(scope, documentId);
        } else {
          // PDF or document — store filename only (no binary)
          saved = addEvidenceItem(siteId, itemKey, { type: 'pdf', name: file.name, sizeBytes: file.size });
        }
        if (!saved) {
          setStorageFull(true);
          break;
        }
      } catch (err) {
        setFileError(err instanceof Error ? err.message : 'The file could not be saved. Please try again.');
        break;
      }
    }
    setEvidenceItems(getEvidenceItems(siteId, itemKey));
    onChanged();
    setUploading(false);
  }

  function handleRemove(itemId: string) {
    const documentId = evidenceItems.find(row => row.id === itemId)?.documentId;
    if (removeEvidenceItem(siteId, itemKey, itemId) && documentId) void removeEvidenceDocument(evidenceDocumentScope(siteId), documentId).catch(() => {});
    setEvidenceItems(getEvidenceItems(siteId, itemKey));
    onChanged();
  }

  async function openDocument(id: string) {
    setFileError('');
    try {
      const blob = await loadEvidenceDocument(siteId, id);
      if (!blob) throw Error('This original PDF is unavailable here. Upload it again from your original copy.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');link.href=url;link.download=evidenceItems.find(row=>row.documentId===id)?.name??'lab-result.pdf';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch (e) { setFileError(e instanceof Error ? e.message : 'The PDF could not be opened.'); }
  }

  function startEditField(fieldKey: string) {
    setEditingField(fieldKey);
    setEditValue(quickNums[fieldKey] ?? '');
  }

  function saveField(fieldKey: string) {
    const saved = setQuickNumber(siteId, group.key, fieldKey, editValue);
    if (!saved) {
      setStorageFull(true);
    }
    setQuickNums(getQuickNumbers(siteId, group.key));
    setEditingField(null);
    onChanged();
  }

  const photoItems = evidenceItems.filter((e) => e.type === 'photo');
  const docItems = evidenceItems.filter((e) => e.type !== 'photo');

  // Close on Escape — matches every other bottom sheet in the app (AddSheet, ThemePanel, etc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={groupLabel}
        className="w-full max-w-md font-sans overflow-y-auto"
        style={{
          background: '#FBF8F1', borderRadius: '22px 22px 0 0',
          maxHeight: '92dvh', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #EFE7D6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: group.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>{EVIDENCE_GROUP_ICON[group.key] ?? '📄'}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '600 17px Newsreader, Georgia, serif', color: '#2D2519' }}>{groupLabel}</div>
              <div style={{ font: '400 11.5px/1.4 system-ui, sans-serif', color: '#8A7C62', marginTop: 1 }}>{groupDesc}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8A7C62' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Land & legal storage warning — THE THING THAT MATTERS MOST for this group.
            A scanned photo is shrunk down for this phone (resizeForStorage, lib/site-evidence.ts);
            an uploaded PDF keeps only its file name, never the file itself (see the "store filename
            only (no binary)" branch in handleFiles below); and either way it lives in this browser's
            localStorage alone, which can silently evict the oldest item once the site's own byte
            budget fills. For a PTO this is often the ONLY proof a farmer has — they must not read
            "saved here" as "backed up here". Keep this ahead of the capture buttons, not below them. */}
        {isLab&&<div style={{padding:'16px 20px',fontSize:13,lineHeight:1.6}}>
          <p>Upload the original test PDF (up to 10 MB) or a clear photograph. PDFs stay on this device and can be downloaded again here. Keep your original copy.</p>
          <p>The report uses the results you enter below. PDF contents are not automatically read; a stored file alone does not establish a measured result.</p>
          <label style={{display:'block',fontWeight:600}}>Results and sampling details<textarea value={resultNote} maxLength={1500} onChange={e=>setResultNote(e.target.value)} placeholder="Sampling date; sample location / ID; laboratory; each result with its unit and method; relevant laboratory comments." style={{display:'block',width:'100%',minHeight:110,padding:10,border:'1px solid #c9d6c9',borderRadius:8,fontSize:14,marginTop:6}}/></label>
          <button disabled={uploading||!resultNote.trim()} onClick={()=>{
            if(getEvidenceItems(siteId,itemKey).length>=4){setFileError('Remove an older entry before adding another.');return;}
            if(!addEvidenceItem(siteId,itemKey,{type:'note',name:'Reported test results',note:resultNote.trim()})){setFileError('The results could not be saved. Keep a copy and try again.');return;}
            setResultNote('');setEvidenceItems(getEvidenceItems(siteId,itemKey));onChanged();
          }} style={{minHeight:44,marginTop:10,padding:'8px 14px',border:'1px solid #285c3e',borderRadius:8}}>Save test results</button>
        </div>}
        {fileError&&<p role="alert" style={{margin:'12px 20px',fontSize:14,color:'#9d2a20'}}>{fileError}</p>}
        {group.key === 'land_legal' && (
          <div style={{
            margin: '14px 20px 0', background: '#FFF6E5', border: '1.5px solid #EFC378',
            borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={18} color="#8A5A0A" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ font: '500 12.5px/1.5 system-ui, sans-serif', color: '#6B4A0E' }}>
              <strong>This app is not a backup.</strong> A photo you scan here is shrunk small; a PDF
              you upload keeps only its file name, not the document. Both live on this phone alone,
              and old items can be deleted automatically to make room for new ones. Keep the real
              papers safe too — with your mentor, at home, or wherever they were issued.
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 9, padding: '15px 20px 0' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              flex: 1, background: '#274D2C', color: '#fff', border: 'none', borderRadius: 11,
              padding: '12px 10px', font: '600 13px/1 system-ui, sans-serif',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            <Camera size={20} color="#CDEBB6" />
            Take / scan photo
          </button>
          <button
            onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = '.pdf,.jpg,.jpeg,.png,image/*'; fileInputRef.current.click(); } }}
            disabled={uploading}
            style={{
              flex: 1, background: '#FBF8F1', color: '#3C6B3F', border: '1.5px solid #CFC4AC', borderRadius: 11,
              padding: '12px 10px', font: '600 13px/1 system-ui, sans-serif',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            <Upload size={20} color="#3C6B3F" />
            Upload file / PDF
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Storage-full error banner */}
        {storageFull && (
          <div style={{
            margin: '12px 20px 0', background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 10, padding: '10px 13px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <span style={{ font: '500 13px/1.4 system-ui, sans-serif', color: '#B91C1C' }}>
              📵 Storage full — photo not saved. Delete some items to free space.
            </span>
            <button
              onClick={() => setStorageFull(false)}
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', flexShrink: 0, padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Photo grid */}
        {photoItems.length > 0 && (
          <div style={{ padding: '15px 20px 0' }}>
            <div style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62', marginBottom: 9 }}>
              Photos · {photoItems.length}
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {photoItems.map((ev) => (
                <div key={ev.id} style={{ position: 'relative', width: 70, height: 70, borderRadius: 9, overflow: 'hidden', background: '#E0D6C2' }}>
                  {ev.dataUrl && (
                    <img data-photo-preview src={ev.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <button
                    onClick={() => handleRemove(ev.id)}
                    aria-label={`Remove ${ev.name || 'photo'}`}
                    style={{
                      position: 'absolute', top: 3, right: 3, background: 'rgba(45,37,25,0.75)',
                      border: 'none', borderRadius: 5, width: 20, height: 20, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={11} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Doc list */}
        {docItems.length > 0 && (
          <div style={{ padding: '15px 20px 0' }}>
            <div style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62', marginBottom: 9 }}>
              On file · {docItems.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {docItems.map((ev) => (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#fff', border: '1px solid #EBE3D2', borderRadius: 11, padding: '10px 13px',
                }}>
                  <div style={{
                    width: 38, height: 44, borderRadius: 6, background: '#F0F4F8', border: '1px solid #DCE5EC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={16} color="#C0392B" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px/1 system-ui, sans-serif', color: '#2D2519', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.name}</div>
                    {ev.note&&<p style={{fontSize:13,lineHeight:1.5,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{ev.note}</p>}
                    {ev.documentId?<button onClick={()=>void openDocument(ev.documentId!)} style={{minHeight:44,fontSize:13,textDecoration:'underline'}}>Download original PDF</button>:isLab&&ev.type==='pdf'&&<p style={{fontSize:13}}>Filename reference only. Upload the PDF again to retain its contents.</p>}
                    {ev.sizeBytes && (
                      <div style={{ font: '400 11px/1 system-ui, sans-serif', color: '#9A8B6E', marginTop: 3 }}>
                        {(ev.sizeBytes / 1024 / 1024).toFixed(1)} MB
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleRemove(ev.id)} aria-label={`Remove ${ev.name || 'document'}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A8B6E', padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick numbers */}
        {quickFields.length > 0 && (
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62', marginBottom: 9 }}>
              Quick numbers (optional)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quickFields.map((f) => (
                <div key={f.key}>
                  {editingField === f.key ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', border: `1.5px solid ${group.color}`, borderRadius: 11, padding: '10px 13px' }}>
                      <span style={{ font: '400 13px/1 system-ui, sans-serif', color: '#6B5D44', flex: 1 }}>{f.label}</span>
                      <input
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveField(f.key); if (e.key === 'Escape') setEditingField(null); }}
                        placeholder={f.unit}
                        style={{ width: 100, font: '600 13px/1 system-ui, sans-serif', color: '#2D2519', border: 'none', outline: 'none', background: 'transparent', textAlign: 'right' }}
                      />
                      <button onClick={() => saveField(f.key)} style={{ font: '600 12px system-ui', color: group.color, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Save</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditField(f.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, background: '#fff',
                        border: '1px solid #EBE3D2', borderRadius: 11, padding: '10px 13px',
                        width: '100%', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ font: '400 13px/1 system-ui, sans-serif', color: '#6B5D44', flex: 1 }}>{f.label}</span>
                      <span style={{ font: quickNums[f.key] ? '600 13px/1 system-ui, sans-serif' : '400 13px/1 system-ui, sans-serif', color: quickNums[f.key] ? '#2D2519' : '#B89C6A' }}>
                        {quickNums[f.key] ? `${quickNums[f.key]} ${f.unit}` : 'Tap to add'}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lima tip */}
        {limaTip && (
          <div style={{ margin: '16px 16px 0', background: '#274D2C', borderRadius: 13, padding: '14px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3C6B3F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {/* Lima sprout glyph */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#CDEBB6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '400 13px/1.45 Newsreader, Georgia, serif', color: '#EAF2E2', fontStyle: 'italic' }}>{limaTip}</div>
              <div style={{ font: '400 10.5px/1 system-ui, sans-serif', color: '#9DBE9D', marginTop: 5 }}>
                {isLab ? 'Site evidence · keep your original documents' : 'Lima · reads bills & reports for you'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
