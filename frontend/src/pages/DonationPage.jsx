import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import BtnAction from '../components/disenio/btn-action'
import violeta1 from '../assets/brand/donacion/violeta1.svg'
import violeta2 from '../assets/brand/donacion/violeta2.svg'
import lineas from '../assets/brand/donacion/lineas.svg'
import flor from '../assets/brand/donacion/flor.svg'
import ondas from '../assets/brand/donacion/ondas.svg'
import circulo from '../assets/brand/donacion/circulo.svg'

const cafecitoPlans = [
  ['1 CAFECITO ($1.000)', '1000'],
  ['3 CAFECITOS ($3.000)', '3000'],
  ['5 CAFECITOS ($5.000)', '5000'],
  ['ELEGÍ OTRO MONTO', 'otro'],
]

const debitPlans = [
  'SOCIO COLABORADOR ($2.000/mes)',
  'SOCIO PROTECTOR ($5.000/mes)',
  'APADRINÁ 1 JORNADA ($10.000/mes)',
  'ELEGÍ OTRO MONTO',
]

function DonationCard({ title, description, children, actionLabel, onAction }) {
  return (
    <article className="donation-card">
      <h2>{title}</h2>
      <p className="donation-card-description">{description}</p>
      <div className="donation-divider" />
      {children}
      {actionLabel && (
        <BtnAction
          href="#donacion"
          onClick={onAction}
          width="220px"
          height="42px"
          className="absolute bottom-[13px] left-1/2 -translate-x-1/2 text-[13px] font-semibold"
        >
          {actionLabel}
        </BtnAction>
      )}
    </article>
  )
}

function DonationPage() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  const copyAlias = async (event) => {
    event.preventDefault()
    try {
      await navigator.clipboard.writeText('OLLA.VEGANA.MP')
      setCopied(true)
      setCopyError(false)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
      setCopyError(true)
    }
  }

  return (
    <>
      <Navbar />
      <main id="donacion" className="donation-page">
        <img src={violeta1} alt="" aria-hidden="true" className="donation-art donation-violeta-one" />
        <img src={violeta2} alt="" aria-hidden="true" className="donation-art donation-violeta-two" />
        <img src={lineas} alt="" aria-hidden="true" className="donation-art donation-lines" />
        <img src={flor} alt="" aria-hidden="true" className="donation-art donation-flower" />
        <img src={ondas} alt="" aria-hidden="true" className="donation-art donation-waves" />
        <img src={circulo} alt="" aria-hidden="true" className="donation-art donation-circle" />

        <h1>¡Ayudanos a ayudar!</h1>
        <section className="donation-cards" aria-label="Formas de colaborar">
          <DonationCard
            title="TRANSFERENCIA BANCARIA"
            description="Doná el importe que quieras directamente en nuestra cuenta bancaria."
            actionLabel={copyError ? 'NO SE PUDO COPIAR' : copied ? '¡ALIAS COPIADO!' : 'COPIAR ALIAS'}
            onAction={copyAlias}
          >
            <p className="bank-name">Banco Provincia</p>
            <p className="bank-alias">Alias: OLLA.VEGANA.MP</p>
            <p className="bank-detail">CBU: 01400502015002050163460</p>
            <p className="bank-detail">Asociación Civil Olla Vegana</p>
            <p className="bank-detail">Cuenta Corriente Nº 50234/9</p>
            <p className="bank-detail">CUIT: 30-71082254-3</p>
            <p className="bank-detail">Sucursal: Morón - Buenos Aires</p>
          </DonationCard>

          <DonationCard
            title="CAFECITO APP"
            description={<>Aportá microdonaciones únicas de forma<br />rápida a través de Mercado Pago.</>}
            actionLabel="DONAR EN CAFECITO"
          >
            <div className="donation-plan-list">
              {cafecitoPlans.map(([label, plan]) => (
                <BtnAction key={label} href={`/donacion?plan=${plan}`} width="240px" height="38px" className="bg-[#AF71DD] text-[12px] font-semibold hover:bg-[#AF71DD]/80">
                  {label}
                </BtnAction>
              ))}
            </div>
          </DonationCard>

          <DonationCard title="POR DÉBITO AUTOMÁTICO" description={<>Adherite al débito automático mensual<br />con tu cuenta de Mercado Pago.</>}>
            <div className="donation-plan-list">
              {debitPlans.map((label) => (
                <button key={label} type="button" disabled className="donation-disabled-plan">
                  {label}
                </button>
              ))}
            </div>
            <button type="button" disabled className="donation-disabled-action">
              DÉBITO AUTOMÁTICO
            </button>
          </DonationCard>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default DonationPage
