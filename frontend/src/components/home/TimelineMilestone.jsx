function TimelineMilestone({ date, title, description, className = '', visible = false, responsive = false }) {
  const widthClass = responsive ? 'w-full max-w-[420px]' : 'w-[155px]'
  const responsiveRevealClass = responsive ? 'timeline-milestone-horizontal-reveal' : ''

  return (
    <div className={`timeline-milestone-reveal ${responsiveRevealClass} ${visible ? 'is-visible' : ''} ${widthClass} -translate-y-1 flex flex-col items-start text-left ${className}`}>
      <div className={`${responsive ? 'ml-0' : '-ml-[3px]'} flex ${responsive ? 'h-[26px] min-w-[76px] px-2 py-1 text-[12px] min-[380px]:text-[13px] sm:h-[28px] sm:min-w-[80px] sm:px-[9px] sm:text-[13px]' : 'h-[29px] min-w-[82px] px-[8px] py-[6px] text-[12px]'} w-fit items-center justify-center whitespace-nowrap rounded-full bg-[#AF71DD] text-center font-scripter font-normal leading-none text-[#F8F3FC]`}>
        {date}
      </div>
      <h3 className={`mt-1.5 font-scripter ${responsive ? 'text-[14px] min-[380px]:text-[15px] sm:text-[15px]' : 'text-[13px]'} font-normal leading-tight text-black`}>
        {title}
      </h3>
      <p className={`mt-1 whitespace-pre-line font-poppins ${responsive ? 'text-[12px] min-[380px]:text-[13px] sm:text-[13px]' : 'text-[11px]'} font-normal leading-snug text-left text-black`}>
        {description}
      </p>
    </div>
  )
}

export default TimelineMilestone
