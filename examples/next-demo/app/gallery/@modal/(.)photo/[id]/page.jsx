import { Suspense } from 'react'
import PhotoDialog from '../../../photo-dialog'
async function Photo({ params }) { return <PhotoDialog id={(await params).id}/> }
export default function Page(props) { return <Suspense fallback={null}><Photo {...props}/></Suspense> }
