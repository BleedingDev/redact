'use server'
export async function failAction() { throw new Error('Expected action failure') }
