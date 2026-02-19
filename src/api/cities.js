import { API_URL } from './config'

export async function fetchCities() {
  const response = await fetch(`${API_URL}/cities/`)
  if (!response.ok) {
    throw new Error('Failed to fetch cities')
  }
  return response.json()
}
