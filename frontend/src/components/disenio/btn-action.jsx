const buttonStyle = {
  color: '#FFF8E9',
  fontFamily: 'Poppins, sans-serif',
  fontSize: '15px',
  letterSpacing: '0.3px',
  fontWeight: 500,
  lineHeight: 'normal',
  padding: '10px 20px',
  borderRadius: '30px',
}

function BtnAction({ href, children, className = '', onClick, width = '174px', height = '48px' }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center gap-[10px] whitespace-nowrap bg-[#AF71DD] transition-colors hover:bg-[#AF71DD]/70 ${className}`}
      style={{ ...buttonStyle, width, height }}
    >
      {children}
    </a>
  )
}

export default BtnAction
