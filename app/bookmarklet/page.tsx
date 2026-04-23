"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Bookmarklet setup page.
 *
 * The user pastes their INGEST_BEARER_TOKEN once, we build a javascript: URL
 * client-side that they drag to their bookmarks bar. The token never leaves
 * their browser. From a licitor.com detail page they click the bookmarklet,
 * it reads the already-loaded DOM and POSTs it to /api/ingest-licitor.
 */
export default function BookmarkletPage() {
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    // remember across reloads so they don't retype
    const saved = window.localStorage.getItem("octionIngestToken");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) window.localStorage.setItem("octionIngestToken", token);
  }, [token]);

  const bookmarkletHref = useMemo(() => {
    if (!token || !origin) return "";
    const endpoint = JSON.stringify(`${origin}/api/ingest-licitor`);
    const tok = JSON.stringify(token);
    // kept terse deliberately — browsers truncate long javascript: URLs
    // and the user has to see the whole thing to drag it.
    const js = `javascript:(async()=>{try{const r=await fetch(${endpoint},{method:'POST',headers:{'Content-Type':'application/json','X-Ingest-Token':${tok}},body:JSON.stringify({url:location.href,html:document.documentElement.outerHTML})});const d=await r.json();const fmt=n=>n?n.toLocaleString('fr-FR')+' €':'—';alert(d.ok?('✓ OCTION · '+d.licitor_id+'\\n'+d.status+'\\nmise : '+fmt(d.mise_a_prix)+'\\nadjudication : '+fmt(d.adjudication_price)):('✗ OCTION\\n'+(d.error||'erreur')));}catch(e){alert('✗ OCTION réseau\\n'+e.message);}})();`;
    return js;
  }, [token, origin]);

  const ready = bookmarkletHref.length > 0;

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-slate-200">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <header>
          <p className="text-xs uppercase tracking-wider text-orange-400 font-semibold mb-2">
            Collecte manuelle
          </p>
          <h1 className="text-3xl font-black bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Bookmarklet OCTION
          </h1>
          <p className="text-slate-400 mt-3 text-sm leading-relaxed">
            Ce petit bouton, glissé dans votre barre de favoris, envoie vers
            OCTION la page licitor.com que vous consultez — <em>sans nouvelle
            requête</em> vers licitor. Le bookmarklet lit simplement le HTML
            que votre navigateur a déjà chargé, et l&apos;envoie à votre API
            d&apos;ingestion.
          </p>
        </header>

        {/* Token input */}
        <section className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            1. Votre jeton d&apos;ingestion
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="INGEST_BEARER_TOKEN"
            className="w-full px-4 py-3 bg-slate-800/70 border border-slate-700 rounded-lg text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-slate-500">
            Il doit correspondre à la variable d&apos;environnement{" "}
            <code className="text-slate-400">INGEST_BEARER_TOKEN</code> définie
            côté serveur. Il est conservé dans le localStorage de ce navigateur
            uniquement — ne le partagez pas.
          </p>
        </section>

        {/* Bookmarklet link */}
        <section className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            2. Glissez ce bouton dans votre barre de favoris
          </label>
          <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-center">
            {ready ? (
              <a
                href={bookmarkletHref}
                onClick={(e) => e.preventDefault()}
                className="inline-block px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg cursor-grab active:cursor-grabbing select-none shadow-lg hover:shadow-orange-500/20 transition-shadow"
                draggable
              >
                📥 Capturer cette enchère
              </a>
            ) : (
              <p className="text-slate-500 text-sm italic">
                Entrez votre jeton pour générer le bookmarklet…
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Si le glisser-déposer ne marche pas : clic droit sur le bouton →
            &laquo; Ajouter aux favoris &raquo; (ou &laquo; Copier le lien &raquo;
            puis créez un favori manuellement avec cette URL).
          </p>
        </section>

        {/* Usage */}
        <section className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            3. Utilisation
          </label>
          <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
            <li>
              Ouvrez une fiche licitor.com comme d&apos;habitude (par exemple en
              consultant un bien qui vous intéresse).
            </li>
            <li>
              Cliquez sur le favori{" "}
              <span className="text-orange-400 font-semibold">
                📥 Capturer cette enchère
              </span>
              .
            </li>
            <li>
              Une pop-up confirme l&apos;enregistrement avec le prix
              d&apos;adjudication s&apos;il est disponible.
            </li>
          </ol>
        </section>

        {/* Live preview of the javascript URL (for debugging / transparency) */}
        {ready && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-400">
              Voir le code du bookmarklet
            </summary>
            <pre className="mt-2 p-3 bg-slate-900/60 border border-slate-800 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-slate-400">
              {bookmarkletHref}
            </pre>
          </details>
        )}

        <footer className="pt-8 border-t border-slate-800 text-xs text-slate-600">
          Aucune donnée licitor.com n&apos;est téléchargée par OCTION : le
          bookmarklet transmet uniquement le HTML que votre navigateur a déjà
          reçu en tant que visiteur humain.
        </footer>
      </div>
    </main>
  );
}
