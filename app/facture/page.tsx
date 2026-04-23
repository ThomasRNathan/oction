'use client'

import { useState, useRef } from 'react'

function formatMontant(val: string): string {
  const n = parseFloat(val.replace(',', '.'))
  if (isNaN(n)) return '0,00'
  return n.toFixed(2).replace('.', ',')
}

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function invoiceNumber(seq: number): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}${m}-${String(seq).padStart(3, '0')}`
}

export default function FacturePage() {
  const [montant, setMontant] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [societe, setSociete] = useState('')
  const [objet, setObjet] = useState('')
  const [seq, setSeq] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const clientName = societe.trim() || `${prenom.trim()} ${nom.trim()}`.trim()
  const montantFormatted = formatMontant(montant)

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setShowPreview(true)
  }

  function handlePrint() {
    window.print()
  }

  function handleReset() {
    setShowPreview(false)
    setSeq(s => s + 1)
  }

  const numFacture = invoiceNumber(seq)
  const dateFacture = todayFR()

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print, #invoice-print * { visibility: visible !important; }
          #invoice-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 40px 50px !important;
            background: white !important;
          }
          @page { margin: 0; size: A4; }
        }
        @media screen {
          #invoice-print {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 48px 56px;
            max-width: 760px;
            margin: 0 auto;
            font-family: 'Georgia', serif;
            color: #1a1a1a;
          }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f8f5f0', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>

        {!showPreview && (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Générateur de factures</h1>
              <p style={{ color: '#6b6b6b', fontSize: 15 }}>Eve Gomy — Artiste plasticienne</p>
            </div>

            <form onSubmit={handleGenerate} style={{ background: 'white', borderRadius: 12, padding: '32px 36px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 28px 0' }}>
                <legend style={{ fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b6b6b', marginBottom: 16 }}>Client</legend>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={labelStyle}>
                      <span style={labelTextStyle}>Prénom</span>
                      <input style={inputStyle} value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Jean" />
                    </label>
                    <label style={labelStyle}>
                      <span style={labelTextStyle}>Nom</span>
                      <input style={inputStyle} value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont" />
                    </label>
                  </div>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Société (optionnel)</span>
                    <input style={inputStyle} value={societe} onChange={e => setSociete(e.target.value)} placeholder="Nom de l'entreprise" />
                  </label>
                </div>
              </fieldset>

              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 28px 0' }}>
                <legend style={{ fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b6b6b', marginBottom: 16 }}>Facture</legend>
                <div style={{ display: 'grid', gap: 14 }}>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Objet / Prestation</span>
                    <input style={inputStyle} value={objet} onChange={e => setObjet(e.target.value)} placeholder="ex. Création d'une œuvre originale" required />
                  </label>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Montant (€)</span>
                    <input
                      style={inputStyle}
                      value={montant}
                      onChange={e => setMontant(e.target.value)}
                      placeholder="1 200,00"
                      required
                      inputMode="decimal"
                    />
                  </label>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>N° de facture</span>
                    <input style={{ ...inputStyle, background: '#f8f8f8', color: '#888' }} value={numFacture} readOnly />
                  </label>
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={!clientName || !montant || !objet}
                style={{
                  width: '100%', padding: '13px', background: '#1a1a1a', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', opacity: (!clientName || !montant || !objet) ? 0.4 : 1
                }}
              >
                Générer la facture
              </button>
            </form>
          </div>
        )}

        {showPreview && (
          <div>
            {/* Toolbar — hidden when printing */}
            <div className="no-print" style={{ maxWidth: 760, margin: '0 auto 24px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={handleReset} style={btnSecondary}>← Nouvelle facture</button>
              <button onClick={handlePrint} style={btnPrimary}>Télécharger / Imprimer PDF</button>
            </div>

            <div id="invoice-print" ref={printRef}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 6 }}>EVE GOMY</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: '#444' }}>
                    30 Rue Feutrier<br />
                    75018 Paris, France<br />
                    SIREN&nbsp;: 903 291 292<br />
                    SIRET&nbsp;: 903 291 292 00014<br />
                    Code APE&nbsp;: 90.03A<br />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px' }}>FACTURE</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>N° {numFacture}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>Date&nbsp;: {dateFacture}</div>
                </div>
              </div>

              {/* Divider */}
              <hr style={{ border: 'none', borderTop: '2px solid #1a1a1a', marginBottom: 36 }} />

              {/* Bill to */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 8 }}>Facturé à</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{clientName}</div>
              </div>

              {/* Line items table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Désignation</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Quantité</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Prix unitaire HT</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>{objet}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>1</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{montantFormatted} €</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{montantFormatted} €</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
                <div style={{ width: 260 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, borderBottom: '1px solid #eee' }}>
                    <span style={{ color: '#666' }}>Total HT</span>
                    <span>{montantFormatted} €</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, borderBottom: '1px solid #eee', color: '#888' }}>
                    <span>TVA</span>
                    <span>Non applicable</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 17, fontWeight: 700, borderTop: '2px solid #1a1a1a', marginTop: 4 }}>
                    <span>Total TTC</span>
                    <span>{montantFormatted} €</span>
                  </div>
                </div>
              </div>

              {/* Legal mention */}
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6, borderTop: '1px solid #eee', paddingTop: 20 }}>
                TVA non applicable en vertu de l'article 293 B du Code Général des Impôts.
              </div>

              {/* Payment info */}
              <div style={{ marginTop: 32, padding: '20px 24px', background: '#f9f9f9', borderRadius: 6, fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Modalités de règlement</div>
                <div style={{ color: '#555' }}>
                  Paiement à réception de la facture.<br />
                  En cas de retard de paiement, des pénalités de retard seront appliquées au taux de trois fois le taux d'intérêt légal en vigueur, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 }
const labelTextStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#444' }
const inputStyle: React.CSSProperties = {
  padding: '10px 12px', border: '1px solid #e2e2e2', borderRadius: 6,
  fontSize: 15, outline: 'none', background: 'white', color: '#1a1a1a', transition: 'border-color 0.15s'
}
const thStyle: React.CSSProperties = { padding: '10px 8px', fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#888', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '14px 8px', fontSize: 14 }
const btnPrimary: React.CSSProperties = { padding: '10px 20px', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 20px', background: 'white', color: '#1a1a1a', border: '1px solid #ddd', borderRadius: 7, fontSize: 14, cursor: 'pointer' }
