function TimelineMilestone({ date, title, description, className = '', visible = false, responsive = false }) {
  const widthClass = responsive ? 'w-full max-w-[520px]' : 'w-[190px]'
  const responsiveRevealClass = responsive ? 'timeline-milestone-horizontal-reveal' : ''

  return (
    <div className={`timeline-milestone-reveal ${responsiveRevealClass} ${visible ? 'is-visible' : ''} ${widthClass} flex flex-col items-start text-left ${className}`}>
      <div className={`${responsive ? 'ml-0' : '-ml-[4px]'} flex ${responsive ? 'h-[30px] min-w-[84px] px-2 py-1 text-[13px] min-[380px]:text-[14px] sm:h-[32px] sm:min-w-[88px] sm:px-[10px] sm:text-[15px]' : 'h-[34px] min-w-[91px] px-[10px] py-[8px] text-[14px]'} w-fit items-center justify-center whitespace-nowrap rounded-full bg-[#AF71DD] text-center font-scripter font-normal leading-none text-[#F8F3FC]`}>
        {date}
      </div>
      <h3 className={`mt-2 font-scripter ${responsive ? 'text-[15px] min-[380px]:text-[16px] sm:text-[17px]' : 'text-[14px]'} font-normal leading-tight text-black`}>
        {title}
      </h3>
      <p className={`mt-1 whitespace-pre-line font-poppins ${responsive ? 'text-[13px] min-[380px]:text-[14px] sm:text-[15px]' : 'text-[13px]'} font-normal leading-snug text-left text-black`}>
        {description}
      </p>
    </div>
  )
}

export default TimelineMilestone
