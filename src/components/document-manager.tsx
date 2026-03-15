"use client";

import { useState, useRef, useCallback } from "react";

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  created_at: string;
}

interface DocumentManagerProps {
  projectId: string;
  initialDocuments: Document[];
  presentationDocId: string | null;
  onDocsChanged?: () => void;
  onPresentationChange?: (docId: string | null) => void;
}

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

function getFileLabel(fileType: string): string {
  return FILE_ICONS[fileType] || fileType.split("/").pop()?.toUpperCase() || "FILE";
}

function getFileBgColor(fileType: string): string {
  if (fileType.includes("pdf")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (fileType.includes("presentation")) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (fileType.includes("word")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return "bg-[#222] text-[#888] border-[#333]";
}

export function DocumentManager({ projectId, initialDocuments, presentationDocId, onDocsChanged, onPresentationChange }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [presDocId, setPresDocId] = useState<string | null>(presentationDocId);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const res = await fetch("/api/project/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const { document } = await res.json();
      setDocuments((prev) => [document, ...prev]);
      onDocsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      uploadFile(file);
    }
    e.target.value = "";
  }, [uploadFile]);

  const [deleteModal, setDeleteModal] = useState<{ docId: string; docName: string } | null>(null);

  const confirmDelete = useCallback(async (forgetKnowledge: boolean) => {
    if (!deleteModal) return;
    const { docId } = deleteModal;
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    if (presDocId === docId) setPresDocId(null);
    setDeleteModal(null);

    try {
      const res = await fetch(`/api/project/documents?id=${docId}&forgetKnowledge=${forgetKnowledge}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete document");
      }
    } catch {
      setError("Failed to delete document");
    }
  }, [deleteModal, presDocId]);

  const handleSetPresentation = useCallback(async (docId: string) => {
    const newId = presDocId === docId ? null : docId;
    setPresDocId(newId);
    onPresentationChange?.(newId);

    try {
      await fetch("/api/project/documents/set-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, documentId: newId }),
      });
    } catch {
      setError("Failed to update presentation document");
    }
  }, [projectId, presDocId, onPresentationChange]);

  return (
    <>
    {/* Delete confirmation modal */}
    {deleteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteModal(null)} />
        <div className="relative bg-[#111] border border-[#333] rounded-xl p-6 space-y-4 max-w-sm w-full mx-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-sm font-semibold text-white">Remove Document</p>
          </div>
          <p className="text-sm text-[#888]">
            Remove <span className="text-white font-medium">{deleteModal.docName}</span>? This document may have contributed knowledge to your agent.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => confirmDelete(true)}
              className="w-full rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 py-2.5 text-sm transition-colors"
            >
              Remove & forget its knowledge
            </button>
            <button
              onClick={() => confirmDelete(false)}
              className="w-full rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] px-4 py-2.5 text-sm transition-colors"
            >
              Remove, keep knowledge
            </button>
            <button
              onClick={() => setDeleteModal(null)}
              className="w-full text-sm text-[#555] hover:text-white py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="bg-[#111] border border-[#262626] rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Documents</h2>
        <p className="text-xs text-[#555] mt-0.5">
          Upload product docs, pitch decks, and other materials for the AI to learn from.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-violet-500 bg-violet-500/5"
            : "border-[#333] hover:border-violet-500/40 bg-[#0d0d0d]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.pptx,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
        <svg className="w-8 h-8 mx-auto text-[#444] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {isUploading ? (
          <p className="text-sm text-violet-400">Uploading...</p>
        ) : (
          <>
            <p className="text-sm text-[#888]">
              Drag & drop files here, or <span className="text-violet-400">browse</span>
            </p>
            <p className="text-xs text-[#444] mt-1">PDF, PPTX, DOCX, TXT</p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`relative group flex flex-col items-center w-32 rounded-xl border p-3 transition-colors ${
                presDocId === doc.id
                  ? "border-violet-500/50 bg-violet-500/5"
                  : "border-[#222] bg-[#0d0d0d] hover:border-[#333]"
              }`}
            >
              {/* Delete button */}
              <button
                onClick={() => setDeleteModal({ docId: doc.id, docName: doc.file_name })}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#333] hover:bg-red-500 text-[#888] hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs"
              >
                &times;
              </button>

              {/* File type badge */}
              <div className={`w-14 h-14 rounded-lg border flex items-center justify-center text-xs font-bold ${getFileBgColor(doc.file_type)}`}>
                {getFileLabel(doc.file_type)}
              </div>

              {/* File name */}
              <p className="text-xs text-[#ccc] mt-2 text-center truncate w-full" title={doc.file_name}>
                {doc.file_name}
              </p>

              {/* Presentation checkbox */}
              <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={presDocId === doc.id}
                  onChange={() => handleSetPresentation(doc.id)}
                  className="w-3 h-3 rounded border-[#444] bg-[#0d0d0d] text-violet-500 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-[10px] text-[#555]">Presentation</span>
              </label>
            </div>
          ))}
        </div>
      )}

      {documents.length === 0 && !isUploading && (
        <p className="text-sm text-[#444]">No documents uploaded yet.</p>
      )}
    </div>
    </>
  );
}
