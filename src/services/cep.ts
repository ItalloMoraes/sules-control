/** Consulta o ViaCEP (serviço público; recebe apenas o CEP digitado). */
export type Address = { street: string; neighborhood: string; city: string; state: string }

export async function lookupCep(raw: string): Promise<Address | null> {
  const cep = raw.replace(/\D/g, '')
  if (cep.length !== 8) return null
  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  if (!r.ok) throw new Error('Não foi possível consultar o CEP agora.')
  const d = await r.json()
  if (d.erro) return null
  return { street: d.logradouro ?? '', neighborhood: d.bairro ?? '', city: d.localidade ?? '', state: d.uf ?? '' }
}
export const addressLine = (a: Address) => [a.street, a.neighborhood, a.city && a.state ? `${a.city}/${a.state}` : a.city].filter(Boolean).join(' · ')

const REGION: Record<string, string> = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste', PR: 'Sul', RS: 'Sul', SC: 'Sul',
}
export const regionOf = (uf?: string | null) => (uf ? REGION[uf] ?? '' : '')
