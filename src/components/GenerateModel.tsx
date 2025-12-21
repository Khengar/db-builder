import { useState, useRef } from "react";
import { X, UploadCloud, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiService } from "../lib/api"; // Ensure this matches your path

interface GenerateModalProps {
  onClose: () => void;
  onSuccess: (jsonData: any) => void;
}

export default function GenerateModal({ onClose, onSuccess }: GenerateModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG)");
      return;
    }
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleGenerate = async () => {
    if (!file) return;

    setLoading(true);
    const toastId = toast.loading("Analyzing image structure...");

    try {
      // 1. Call your Local API
      const data = await ApiService.generateSchema(file);
      
      toast.dismiss(toastId);
      toast.success("Schema generated successfully!");
      
      // 2. Pass data back to App
      onSuccess(data);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to generate schema");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Image to Schema</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Drop Zone */}
          <div 
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
            }}
            className={`relative group cursor-pointer border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center transition-all overflow-hidden ${
              file ? 'border-violet-500/50 bg-violet-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            <input 
              ref={inputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
            />

            {preview ? (
              <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 group-hover:border-zinc-700 shadow-xl">
                  <UploadCloud size={24} />
                </div>
                <p className="text-xs font-medium">Click or Drag Image Here</p>
              </div>
            )}
          </div>

          {/* Action */}
          <button
            onClick={handleGenerate}
            disabled={!file || loading}
            className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all ${
              !file || loading 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20 active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Schema</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}