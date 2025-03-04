export const getStartOfWorkWeek = () => {
  const today = new Date()
  const weekday = today.getDay()
  const startOfWorkWeek = new Date(today)
  startOfWorkWeek.setDate(today.getDate() - weekday + 1)
  startOfWorkWeek.setHours(0, 0, 0)

  return startOfWorkWeek
}
