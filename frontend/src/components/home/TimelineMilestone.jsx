function TimelineMilestone({ date, title, description, className = '', visible = false }) {
  return (
    <div className={`timeline-milestone-reveal ${visible ? 'is-visible' : ''} flex w-[190px] flex-col items-start text-left ${className}`}>
      <div className="-ml-[5px] flex h-[41px] w-fit min-w-[91px] items-center justify-center whitespace-nowrap rounded-full bg-[#AF71DD] px-[10px] py-[10px] text-center font-scripter text-[14px] font-normal leading-none text-[#F8F3FC]">
        {date}
      </div>
      <h3 className="mt-2 font-scripter text-[14px] font-normal leading-tight text-black">
        {title}
      </h3>
      <p className="mt-1 whitespace-pre-line font-poppins text-[13px] font-normal leading-snug text-left text-black">
        {description}
      </p>
    </div>
  )
}

export default TimelineMilestone
