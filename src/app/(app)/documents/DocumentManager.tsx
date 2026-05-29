'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Trash2, Download, File } from 'lucide-react'

type Document = {
  id: string
  name: string
  file_path: string
  file_size: number
  file_type: string
  created_at: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function DocumentManager({ documents, userId }: { documents: Document[], userId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  async function uploadFile(file: File) {
    if (!file) return
    setUploading(true)
    setError('')
    const supabase = createClient()
    const path = `${userId}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    await supabase.from('documents').insert({
      user_id: userId,
      name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type,
    })
    setUploading(false)
    router.refresh()
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
    e.target.value = ''
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) await uploadFile(file)
  }

  async function downloadDocument(doc: Document) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDocument(doc: Document) {
    const supabase = createClient()
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    router.refresh()
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 mb-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileInput} />
        <Upload size={32} className="mx-auto mb-3 text-slate-400" />
        {uploading ? (
          <p className="font-medium text-indigo-600">Uploading...</p>
        ) : (
          <>
            <p className="font-medium text-slate-700">Drop a file here or click to upload</p>
            <p className="text-sm text-slate-400 mt-1">PDF, images, spreadsheets — any format</p>
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Uploaded Documents <span className="text-slate-400 font-normal">({documents.length})</span></h2>
        </div>

        {documents.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No documents yet</p>
            <p className="text-sm">Upload your first document above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <File size={16} className="text-indigo-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{doc.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => downloadDocument(doc)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download size={15} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => deleteDocument(doc)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
