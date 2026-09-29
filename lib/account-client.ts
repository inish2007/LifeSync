export interface Account { id: string; name: string; email: string; phone: string; consent: boolean; verified: boolean }
export async function accountApi(path: string, body?: unknown) {
  const response = await fetch(`/api/lifeloop/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json() as { user: Account; mode: string; consent: boolean; verified: boolean; url: string; error?: string; messages: {id:string;body:string;direction:string;state:string;createdAt:number}[] };
  if (!response.ok) throw new Error(data.error || 'Could not connect. Please try again.');
  return data;
}
