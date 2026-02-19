const explicitApiUrl = import.meta.env.VITE_API_URL

const inferredHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const inferredApiUrl = `http://${inferredHost}:8000`

export const API_URL = explicitApiUrl
	? explicitApiUrl.replace(/\/+$/, '')
	: import.meta.env.DEV
		? inferredApiUrl
		: ''
