/**
 * Public landing page for Alfares Allegro.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

const workflowSteps = [
  {
    label: '1',
    title: 'Založte si účet',
    copy: 'Použijte účet Alfares a vstupte do hlídaného pracovního prostoru pro prodej na Allegro.',
  },
  {
    label: '2',
    title: 'Vyberte produkty z katalogu',
    copy: 'Začněte u produktů, které už jsou v katalogu. Před jakoukoli akcí na tržišti vidíte obrázky, skladové informace, ceny i poznámky prodejce.',
  },
  {
    label: '3',
    title: 'Připravte návrh nabídky',
    copy: 'Vytvořte zkontrolovaný návrh nabídky pro Allegro místo odesílání neúplných produktových dat přímo na tržiště.',
  },
  {
    label: '4',
    title: 'Zkontrolujte připravenost',
    copy: 'Před potvrzením publikace ověřte připojení účtu, stav OAuth, pravidla tržiště, povinná pole, vhodnost kategorie i provozní připravenost.',
  },
  {
    label: '5',
    title: 'Publikaci potvrďte ručně',
    copy: 'Publikace je vědomé rozhodnutí uživatele. Služba drží cestu z katalogu na Allegro pod kontrolou a zastaví se tam, kde je potřeba lidské rozhodnutí.',
  },
  {
    label: '6',
    title: 'Sledujte stav a objednávky',
    copy: 'V jednom provozním panelu sledujte stav na tržišti, blokované nebo čekající položky, signály objednávek a návazné kroky.',
  },
];

const guardrails = [
  'Připravenost Allegro účtu a OAuth je viditelná před akcemi na tržišti.',
  'Kontrola pravidel, povinných dat a připravenosti nabídky probíhá před potvrzením.',
  'Výběr z katalogu, příprava návrhu, potvrzení publikace a monitoring zůstávají oddělené.',
  'Po spuštění nabídek se sleduje stav publikace i objednávky.',
];

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Domů Alfares Allegro">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500 text-lg font-bold text-white">
              A
            </span>
            <span className="text-lg font-semibold tracking-normal">Alfares Allegro</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex" aria-label="Navigace úvodní stránky">
            <a className="hover:text-slate-950" href="#workflow">Průběh</a>
            <a className="hover:text-slate-950" href="#guardrails">Kontroly</a>
            <a className="hover:text-slate-950" href="#workspace">Pracoviště</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/register">
              <Button size="small">Začít prodávat na Allegro</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-24">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-300">Služba pro prodej na Allegro</p>
              <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                Připravujte katalogové produkty pro Allegro s kontrolou před každou publikací.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Alfares Allegro pomáhá prodejcům přejít od výběru produktu z katalogu k přípravě návrhu nabídky, kontrole připravenosti, ručnímu potvrzení publikace a sledování stavu nebo objednávek bez automatického publikování bez dohledu.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="large" className="w-full bg-orange-500 hover:bg-orange-600 focus:ring-orange-400 sm:w-auto">
                    Začít prodávat na Allegro
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-slate-950/30" aria-label="Náhled pracoviště Alfares Allegro">
              <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex gap-2" aria-hidden="true">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-300" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <span className="text-sm text-slate-400">allegro.alfares.cz</span>
              </div>
              <div className="space-y-4">
                <div className="rounded-md bg-white p-4 text-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">Katalogový produkt</p>
                      <strong className="text-lg">Sada akumulátorové vrtačky</strong>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Kontrola návrhu</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-slate-200 p-3">
                      <span className="text-xs uppercase text-slate-500">Účet</span>
                      <p className="font-semibold">OAuth připraven</p>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <span className="text-xs uppercase text-slate-500">Pravidla</span>
                      <p className="font-semibold">Čeká na kontrolu</p>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <span className="text-xs uppercase text-slate-500">Akce</span>
                      <p className="font-semibold">Potvrdit publikaci</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-700 p-4">
                    <p className="text-sm text-slate-400">Fronta stavů</p>
                    <p className="mt-2 text-3xl font-bold">12</p>
                    <p className="text-sm text-slate-400">návrhů, kontrol a aktivních nabídek</p>
                  </div>
                  <div className="rounded-md border border-slate-700 p-4">
                    <p className="text-sm text-slate-400">Monitoring objednávek</p>
                    <p className="mt-2 text-3xl font-bold">Aktivní</p>
                    <p className="text-sm text-slate-400">signály směrované do provozu</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-16" id="workflow">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold tracking-normal text-slate-950">Hlídaný postup z katalogu na Allegro</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Služba je postavená na jasných rozhodnutích prodejce a kontrolách připravenosti, ne na publikování na pozadí bez revize.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workflowSteps.map((step) => (
                <article key={step.label} className="rounded-lg border border-slate-200 bg-white p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100 text-sm font-bold text-orange-700">
                    {step.label}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16" id="guardrails">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1fr] lg:px-8">
            <div>
              <h2 className="text-3xl font-bold tracking-normal text-slate-950">Připravenost před dopadem na tržiště</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Alfares Allegro udržuje přípravu produktu, kontrolu účtu, revizi pravidel a závěrečné potvrzení viditelné, aby operátoři věděli, co je připravené a co ještě vyžaduje pozornost.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {guardrails.map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 h-1.5 w-12 rounded-full bg-orange-500" />
                  <p className="leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-950 py-16 text-white" id="workspace">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.75fr] lg:px-8">
            <div>
              <h2 className="text-3xl font-bold tracking-normal">Jedno pracoviště pro provoz prodejce</h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                V panelu postupujete od vybraných katalogových produktů k návrhům pro Allegro, potvrzujete pouze při jasné připravenosti a následně sledujete stav publikace i objednávky.
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
              <dl className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Hlavní vstup</dt>
                  <dd className="text-right font-semibold">Katalogové produkty</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Cílové tržiště</dt>
                  <dd className="text-right font-semibold">Návrh pro Allegro</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Režim publikace</dt>
                  <dd className="text-right font-semibold">Ruční potvrzení</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Po publikaci</dt>
                  <dd className="text-right font-semibold">Stav a objednávky</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-semibold text-slate-700">Alfares Allegro</span>
          <span>Hlídaný postup pro prodejce na Allegro s produkty z katalogu.</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
