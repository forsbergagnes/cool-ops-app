export const getEndOfWorkWeek = () => {
  const today = new Date()
  const weekday = today.getDay()
  const endOfWorkWeek = new Date(today)
  endOfWorkWeek.setDate(today.getDate() + 5 - weekday)
  endOfWorkWeek.setHours(17, 0, 0)

  return endOfWorkWeek
}
