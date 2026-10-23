const buttonStyle = {
  color: '#FFF8E9',
  fontFamily: 'Poppins, sans-serif',
  fontSize: '15px',
  letterSpacing: '0.3px',
  lineHeight: 'normal',
  padding: '10px 20px',
  borderRadius: '30px',
}

function BtnAction({ href, children, className = '', onClick, target, rel, width = '174px', height = '48px', fontSize, responsive = false, fluid = false }) {
  const responsiveSize = responsive ? 'h-[40px] w-[128px] text-[14px] sm:h-[44px] sm:w-[140px] lg:h-[48px] lg:w-[154px] lg:text-[15px]' : ''
  const responsiveWeight = responsive ? 'font-extralight lg:font-normal' : 'font-medium'

  return (
    <a
      href={href}
      onClick={onClick}
      target={target}
      rel={rel}
      className={`inline-flex shrink-0 items-center justify-center gap-[10px] ${fluid ? 'whitespace-normal' : 'whitespace-nowrap'} bg-[#AF71DD] transition-colors hover:bg-[#AF71DD]/70 ${responsiveSize} ${responsiveWeight} ${className}`}
      style={{ ...buttonStyle, fontSize: responsive || fluid ? undefined : fontSize || buttonStyle.fontSize, width: responsive || fluid ? undefined : width, height: responsive || fluid ? undefined : height }}
    >
      {children}
    </a>
  )
}

export default BtnAction
