/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Table as TableIcon,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { analyzeReceipt, ReceiptData } from './services/geminiService';
import { cn } from './lib/utils';

interface ProcessingFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: ReceiptData;
  error?: string;
}

export default function App() {
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: ProcessingFile[] = Array.from(e.target.files).map((file: File) => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) URL.revokeObjectURL(fileToRemove.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const processFiles = async () => {
    setIsProcessing(true);
    
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    
    for (const fileItem of pendingFiles) {
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'processing' } : f));
      
      try {
        const base64 = await fileToBase64(fileItem.file);
        const data = await analyzeReceipt(base64, fileItem.file.type);
        
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          status: 'completed', 
          data 
        } : f));
      } catch (err) {
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          status: 'error', 
          error: err instanceof Error ? err.message : 'Unknown error' 
        } : f));
      }
    }
    
    setIsProcessing(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const exportToExcel = () => {
    const completedData = files
      .filter(f => f.status === 'completed' && f.data)
      .map(f => ({
        'Date': f.data!.date,
        'Merchant': f.data!.merchant,
        'Category': f.data!.category,
        'Amount': f.data!.amount,
        'Currency': f.data!.currency,
        'Description': f.data!.description,
      }));

    if (completedData.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(completedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Receipts");
    XLSX.writeFile(wb, `Receipts_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalAmount = files
    .filter(f => f.status === 'completed' && f.data)
    .reduce((sum, f) => sum + (f.data?.amount || 0), 0);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Receipt Batcher</h1>
          <p className="text-slate-500 mt-1">Upload receipts and convert them to Excel automatically.</p>
        </div>
        <div className="flex gap-3">
          {files.some(f => f.status === 'completed') && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              <Download size={18} />
              Export to Excel
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add Receipts
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileSelect}
            multiple
            accept="image/*,application/pdf"
            className="hidden"
          />
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload & Preview Section */}
        <div className="lg:col-span-1 space-y-6">
          <div 
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors",
              files.length === 0 ? "border-slate-300 bg-white" : "border-indigo-200 bg-indigo-50/30"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) {
                const newFiles: ProcessingFile[] = Array.from(e.dataTransfer.files).map((file: File) => ({
                  id: Math.random().toString(36).substring(7),
                  file,
                  preview: URL.createObjectURL(file),
                  status: 'pending' as const,
                }));
                setFiles(prev => [...prev, ...newFiles]);
              }
            }}
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
              <Upload size={24} />
            </div>
            <h3 className="font-semibold text-slate-900">Drop receipts here</h3>
            <p className="text-sm text-slate-500 mt-1">Images or PDF files supported</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Select Files
            </button>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">Files ({files.length})</h3>
                <button 
                  onClick={processFiles}
                  disabled={isProcessing || !files.some(f => f.status === 'pending' || f.status === 'error')}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : null}
                  Process All
                </button>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {files.map((fileItem) => (
                    <motion.div
                      key={fileItem.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 group"
                    >
                      <div className="relative w-12 h-12 rounded overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                        {fileItem.file.type === 'application/pdf' ? (
                          <FileText size={24} className="text-indigo-500" />
                        ) : (
                          <img 
                            src={fileItem.preview} 
                            alt="preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {fileItem.status === 'processing' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 size={16} className="text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{fileItem.file.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {fileItem.status === 'completed' && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 uppercase tracking-wider">
                              <CheckCircle2 size={10} /> Done
                            </span>
                          )}
                          {fileItem.status === 'error' && (
                            <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 uppercase tracking-wider">
                              <AlertCircle size={10} /> Error
                            </span>
                          )}
                          {fileItem.status === 'pending' && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Pending
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">{(fileItem.file.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFile(fileItem.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Data View Section */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <TableIcon size={20} className="text-slate-400" />
                <h2 className="font-semibold text-slate-900">Extracted Data</h2>
              </div>
              {totalAmount > 0 && (
                <div className="text-sm font-medium text-slate-600">
                  Total: <span className="text-indigo-600 font-bold">{totalAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-x-auto">
              {files.some(f => f.status === 'completed') ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                      <th className="px-6 py-3 border-b border-slate-100">Date</th>
                      <th className="px-6 py-3 border-b border-slate-100">Merchant</th>
                      <th className="px-6 py-3 border-b border-slate-100">Category</th>
                      <th className="px-6 py-3 border-b border-slate-100 text-right">Amount</th>
                      <th className="px-6 py-3 border-b border-slate-100">Currency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.filter(f => f.status === 'completed' && f.data).map((fileItem) => (
                      <tr key={fileItem.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                          {fileItem.data?.date}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {fileItem.data?.merchant}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            fileItem.data?.category === 'Dining' && "bg-orange-100 text-orange-700",
                            fileItem.data?.category === 'Travel' && "bg-blue-100 text-blue-700",
                            fileItem.data?.category === 'Supplies' && "bg-purple-100 text-purple-700",
                            fileItem.data?.category === 'Other' && "bg-slate-100 text-slate-700",
                          )}>
                            {fileItem.data?.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono font-medium text-slate-900 text-right">
                          {fileItem.data?.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                          {fileItem.data?.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4">
                    <FileText size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">No data extracted yet</h3>
                  <p className="text-slate-500 max-w-xs mt-2">
                    Upload and process your receipts to see the extracted information here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
