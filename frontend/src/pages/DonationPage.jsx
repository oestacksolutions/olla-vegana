import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import BtnAction from '../components/disenio/btn-action'
import violeta1 from '../assets/svg/violeta1.svg'
import violeta2 from '../assets/svg/violeta2.svg'
import lineas from '../assets/svg/lineas.svg'
import flor from '../assets/svg/flor.svg'
import ondas from '../assets/svg/ondas.svg'
import circulo from '../assets/svg/circulo.svg'

const cafecitoPlans = [
  ['1 CAFECITO ($7625)', 'https://www.mercadopago.com.ar/checkout/v1/payment/redirect/1a5d5a6d-6491-439f-b177-709eafe1cbdb/payment-option-form/?router-request-id=fe38dd35-6cad-435a-b2d4-666d1b713ac7&preference-id=1142261062-e1894595-b1cd-4c89-802c-2c86951d64dc&p=3c22dbd1a5abdd7add3aa65e851e082d'],
  ['3 CAFECITOS ($22875)', 'https://www.mercadopago.com.ar/checkout/v1/payment/redirect/fdb90f0f-9455-47ba-b905-4a4e46210e0b/payment-option-form/?router-request-id=9809e6a1-4451-4a0f-83c7-ed7522e63a56&preference-id=1142261062-b92a4fea-377b-46aa-9ca8-4552fb7929ad&p=3c22dbd1a5abdd7add3aa65e851e082d'],
  ['5 CAFECITOS ($38125)', 'https://www.mercadopago.com.ar/checkout/v1/payment/redirect/9b592cbe-940d-4a6d-a671-59770033e2cc/payment-option-form/?router-request-id=4892172e-7b80-473c-b93c-4dd7f80b81c7&preference-id=1142261062-2dd95920-4b1d-4ce6-b642-3d141e7355f0&p=3c22dbd1a5abdd7add3aa65e851e082d'],
  ['10 CAFECITOS ($76250)', 'https://www.mercadopago.com.ar/checkout/v1/payment/redirect/aeeddd18-82ee-4ab5-b145-1e23feeaa0b1/payment-option-form/?router-request-id=c81dec3c-ce5f-4741-a09b-74f0e4f839ff&preference-id=1142261062-8665b35c-8bcb-4e21-8e88-871ec388888b&p=3c22dbd1a5abdd7add3aa65e851e082d'],
  [
    <>
      ELEGÍ OTRO MONTO<br />/ TRANSFERENCIA
    </>,
    'https://cafecito.app/ollavegana'
  ],
]

const debitPlans = [
  ['SOCIO COLABORADOR ($2.000/mes)', 'https://www.enlacevaaca.com'],
  ['SOCIO PROTECTOR ($5.000/mes)', 'https://www.enlacevaaca.com'],
  ['APADRINÁ 1 JORNADA ($10.000/mes)', 'https://www.enlacevaaca.com'],
  ['ELEGÍ OTRO MONTO', 'https://www.enlacevaaca.com'],
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

  const copyAlias = async (event) => {
    if (event) event.preventDefault()
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText('OLLA.VEGANA.MP')
      } else {
        const input = document.createElement('textarea')
        input.value = 'OLLA.VEGANA.MP'
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        const copiedWithFallback = document.execCommand('copy')
        input.remove()
        if (!copiedWithFallback) throw new Error('No se pudo copiar el alias')
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <Navbar />
      <main id="donacion" className="donation-page md:pt-16 lg:pt-24">
        <img src={violeta1} alt="" aria-hidden="true" className="donation-art donation-violeta-one" />
        <img src={violeta2} alt="" aria-hidden="true" className="donation-art donation-violeta-two" />
        <img src={lineas} alt="" aria-hidden="true" className="donation-art donation-lines" />
        <img src={flor} alt="" aria-hidden="true" className="donation-art donation-flower" />
        <img src={ondas} alt="" aria-hidden="true" className="donation-art donation-waves" />
        <img src={circulo} alt="" aria-hidden="true" className="donation-art donation-circle" />

        <div className="relative z-[2] mx-auto -mt-2 mb-1 flex w-full max-w-[1120px] justify-center sm:-mt-3 sm:justify-end lg:-translate-y-8 lg:translate-x-16">
          <BtnAction
            href="mailto:organizadoresollavegana@gmail.com"
            fluid
            className="h-auto min-h-[46px] w-[min(210px,100%)] max-w-full whitespace-normal px-4 py-2 text-center text-[14px] font-semibold sm:min-h-[50px] sm:text-[15px]"
          >
            Doná Insumos
          </BtnAction>
        </div>
        <h1 className="donation-title-appear">¡Ayudanos a ayudar!</h1>
        <section className="donation-cards" aria-label="Formas de colaborar">
          {/* TARJETA 1 */}
          <DonationCard
            title="TRANSFERENCIA BANCARIA"
            description="Doná el importe que quieras directamente en nuestra cuenta bancaria."
          >
            <div className="flex flex-col items-center">
              <p className="bank-name">Nombre: Wanda Montes</p>
              <p className="bank-name">CUIT/CUIL: **-*****216-**</p>
              <p className="bank-name">Entidad: Mercado Pago</p>

              <button
                type="button"
                onClick={copyAlias}
                title="Copiar alias"
                aria-label="Copiar alias"
                className="mt-4 flex items-center justify-center gap-2 bank-alias cursor-pointer transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <span>Alias: olla.vegana.mp</span>
                {copied ? (
                  <Check className="h-5 w-5 text-green-300 shrink-0" />
                ) : (
                  <Copy className="h-5 w-5 text-white shrink-0" />
                )}
              </button>
            </div>
          </DonationCard>

          {/* TARJETA 2 */}
          <DonationCard
            title="CAFECITO APP"
            description={<>Aportá microdonaciones únicas de forma<br />rápida a través de Mercado Pago.</>}
          >
            <div className="donation-plan-list flex flex-col items-center !w-full gap-2">
              {cafecitoPlans.map(([label, href], index) => (
                <BtnAction
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="!w-full !max-w-[280px] !px-3 !h-auto !min-h-[40px] !py-2 text-center !whitespace-normal text-[11px] sm:text-[12px] font-semibold bg-[#AF71DD] text-white hover:bg-[#AF71DD]/80 flex items-center justify-center !leading-tight transition-all"
                >
                  {label}
                </BtnAction>
              ))}
            </div>
          </DonationCard>

          {/* TARJETA 3 */}
          <DonationCard
            title="DÉBITO AUTOMÁTICO"
            description={<>Adherite al débito automático mensual<br />con tu cuenta.</>}
          >
            <div className="donation-plan-list">
              {debitPlans.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="donation-disabled-plan inline-flex items-center justify-center text-center no-underline"
                >
                  {label}
                </a>
              ))}
            </div>
          </DonationCard>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default DonationPage
