/**
 * Public landing page for Alfares Allegro.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

const workflowSteps = [
  {
    label: '1',
    title: 'Register or sign in',
    copy: 'Use your Alfares account to enter a guarded workspace for Allegro marketplace operations.',
  },
  {
    label: '2',
    title: 'Select catalog products',
    copy: 'Start from products already present in the catalog, with images, stock context, pricing data, and seller notes visible before any marketplace action.',
  },
  {
    label: '3',
    title: 'Prepare an Allegro draft',
    copy: 'Build a reviewed listing draft for Allegro instead of pushing incomplete product data straight to the marketplace.',
  },
  {
    label: '4',
    title: 'Review readiness gates',
    copy: 'Check account connection, OAuth state, marketplace policy, required fields, category fit, and operational readiness before publish confirmation.',
  },
  {
    label: '5',
    title: 'Confirm publish explicitly',
    copy: 'Publishing is an intentional user action. The service keeps the catalog-to-Allegro path guarded and stops when a human decision is required.',
  },
  {
    label: '6',
    title: 'Monitor status and orders',
    copy: 'Track marketplace state, blocked or waiting items, order signals, and follow-up actions from one operational dashboard.',
  },
];

const guardrails = [
  'Allegro account and OAuth readiness are visible before marketplace actions.',
  'Policy, required data, and listing readiness checks happen before confirmation.',
  'Catalog selection, draft preparation, publish confirmation, and monitoring stay separate.',
  'Orders and publication status are tracked after listing activity begins.',
];

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Alfares Allegro home">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500 text-lg font-bold text-white">
              A
            </span>
            <span className="text-lg font-semibold tracking-normal">Alfares Allegro</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex" aria-label="Landing navigation">
            <a className="hover:text-slate-950" href="#workflow">Workflow</a>
            <a className="hover:text-slate-950" href="#guardrails">Guardrails</a>
            <a className="hover:text-slate-950" href="#workspace">Workspace</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="secondary" size="small">Sign in</Button>
            </Link>
            <Link to="/register" className="hidden sm:block">
              <Button size="small">Register</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-24">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-300">Allegro marketplace service</p>
              <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                Prepare catalog products for Allegro with review gates before every publish.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Alfares Allegro helps sellers move from catalog product selection to Allegro draft preparation, readiness review, explicit publish confirmation, and status or order monitoring without claiming autonomous marketplace publishing.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="large" className="w-full bg-orange-500 hover:bg-orange-600 focus:ring-orange-400 sm:w-auto">
                    Create account
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary" size="large" className="w-full bg-white text-slate-950 hover:bg-slate-100 sm:w-auto">
                    Sign in
                  </Button>
                </Link>
                <Link to="/dashboard/products">
                  <Button variant="secondary" size="large" className="w-full border border-slate-500 bg-slate-900 text-white hover:bg-slate-800 sm:w-auto">
                    Open products
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-slate-950/30" aria-label="Alfares Allegro dashboard preview">
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
                      <p className="text-sm text-slate-500">Catalog product</p>
                      <strong className="text-lg">Cordless drill set</strong>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Draft review</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-slate-200 p-3">
                      <span className="text-xs uppercase text-slate-500">Account</span>
                      <p className="font-semibold">OAuth ready</p>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <span className="text-xs uppercase text-slate-500">Policy</span>
                      <p className="font-semibold">Needs review</p>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <span className="text-xs uppercase text-slate-500">Action</span>
                      <p className="font-semibold">Confirm publish</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-700 p-4">
                    <p className="text-sm text-slate-400">Status queue</p>
                    <p className="mt-2 text-3xl font-bold">12</p>
                    <p className="text-sm text-slate-400">drafts, reviews, and active offers</p>
                  </div>
                  <div className="rounded-md border border-slate-700 p-4">
                    <p className="text-sm text-slate-400">Orders monitor</p>
                    <p className="mt-2 text-3xl font-bold">Live</p>
                    <p className="text-sm text-slate-400">signals routed to operations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-16" id="workflow">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold tracking-normal text-slate-950">A guarded catalog-to-Allegro workflow</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                The service is built around clear seller decisions and marketplace readiness checks, not background publishing without review.
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
              <h2 className="text-3xl font-bold tracking-normal text-slate-950">Readiness before marketplace impact</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Alfares Allegro keeps product preparation, account checks, policy review, and final confirmation visible so operators know what is ready and what still needs attention.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Link to="/dashboard/products">
                  <Button className="w-full sm:w-auto">Review products</Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary" className="w-full sm:w-auto">Sign in first</Button>
                </Link>
              </div>
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
              <h2 className="text-3xl font-bold tracking-normal">One workspace for seller operations</h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Use the dashboard to move from selected catalog products to Allegro drafts, confirm only when readiness is clear, then keep publication status and order activity in view.
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
              <dl className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Primary entry</dt>
                  <dd className="text-right font-semibold">Catalog products</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Marketplace target</dt>
                  <dd className="text-right font-semibold">Allegro draft</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Publish mode</dt>
                  <dd className="text-right font-semibold">Explicit confirmation</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">After publish</dt>
                  <dd className="text-right font-semibold">Status and orders</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-semibold text-slate-700">Alfares Allegro</span>
          <span>Guarded marketplace workflow for catalog-backed Allegro sellers.</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
