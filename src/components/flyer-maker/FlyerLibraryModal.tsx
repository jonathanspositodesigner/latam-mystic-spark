import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2, ImageIcon, Upload, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import imageCompression from 'browser-image-compression';
import { useSmartSearch } from '@/hooks/useSmartSearch';
import { isAcceptedImage, ensureBrowserCompatibleImage, IMAGE_ACCEPT } from '@/lib/heicConverter';
import { toast } from 'sonner';

interface FlyerLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto: (imageUrl: string) => void;
  onUploadPhoto?: (dataUrl: string, file: File) => void;
  categorySlug?: string;
}

interface FlyerItem {
  id: string;
  title: string;
  image_url: string;
  category: string;
  category_id: string | null;
}

interface CategoryTab {
  id: string;
  name: string;
  slug: string;
  display_order: number;
}

const TOOL_SLUG = 'flyer_maker';

const FlyerLibraryModal: React.FC<FlyerLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectPhoto,
  onUploadPhoto,
  categorySlug,
}) => {
  const [flyers, setFlyers] = useState<FlyerItem[]>([]);
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { searchTerm, setSearchTerm, expandedTerms } = useSmartSearch();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: catData } = await supabase
        .from('ai_tool_library_categories')
        .select('id, name, slug, display_order')
        .eq('tool_slug', TOOL_SLUG)
        .order('display_order', { ascending: true });
      setCategories(catData || []);

      let libItems: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('ai_tool_library_items')
          .select('source_id, category_id, display_order')
          .eq('tool_slug', TOOL_SLUG)
          .eq('is_visible', true)
          .order('display_order', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        libItems = libItems.concat(data || []);
        if (!data || data.length < PAGE) break;
      }

      const sourceIds = libItems.map(i => i.source_id);
      if (sourceIds.length === 0) { setFlyers([]); return; }

      const CHUNK = 100;
      const allArtes: any[] = [];
      for (let i = 0; i < sourceIds.length; i += CHUNK) {
        const { data } = await supabase
          .from('admin_artes')
          .select('id, title, image_url, category')
          .in('id', sourceIds.slice(i, i + CHUNK))
          .not('image_url', 'like', '%.mp4');
        if (data) allArtes.push(...data);
      }

      const catById = new Map(libItems.map(i => [i.source_id, i.category_id]));
      const merged: FlyerItem[] = allArtes.map(a => ({
        id: a.id,
        title: a.title,
        image_url: a.image_url,
        category: a.category,
        category_id: catById.get(a.id) ?? null,
      }));

      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]];
      }

      setFlyers(merged);
    } catch (err) {
      console.error('[FlyerLibrary] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveCategoryId('all');
      fetchAll();
    }
  }, [isOpen, fetchAll]);

  useEffect(() => {
    if (categorySlug && categories.length > 0) {
      const found = categories.find(c => c.slug === categorySlug);
      if (found) setActiveCategoryId(found.id);
    }
  }, [categorySlug, categories]);

  const visibleFlyers = useMemo(() => {
    let list = flyers;
    if (activeCategoryId === 'uncategorized') list = list.filter(f => !f.category_id);
    else if (activeCategoryId !== 'all') list = list.filter(f => f.category_id === activeCategoryId);

    if (expandedTerms.length > 0) {
      const terms = expandedTerms.map(t => t.toLowerCase());
      list = list.filter(f => {
        const hay = `${f.title} ${f.category}`.toLowerCase();
        return terms.some(t => hay.includes(t));
      });
    }
    return list;
  }, [flyers, activeCategoryId, expandedTerms]);

  useEffect(() => { setVisibleCount(20); }, [activeCategoryId, searchTerm]);

  const displayedFlyers = useMemo(() => visibleFlyers.slice(0, visibleCount), [visibleFlyers, visibleCount]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = event.target.files?.[0];
    if (!rawFile || !onUploadPhoto) return;
    if (!isAcceptedImage(rawFile)) { toast.error('Selecciona una imagen válida'); return; }
    setIsUploading(true);
    try {
      const file = await ensureBrowserCompatibleImage(rawFile);
      const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true });
      const reader = new FileReader();
      reader.onloadend = () => { onUploadPhoto(reader.result as string, compressed as unknown as File); onClose(); };
      reader.readAsDataURL(compressed);
    } catch (err) {
      toast.error('Error al procesar la imagen');
    } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[calc(100%-32px)] bg-background border border-purple-500/40 max-h-[80vh] overflow-hidden flex flex-col p-4 sm:p-6 rounded-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
            Biblioteca de Flyers
          </DialogTitle>
        </DialogHeader>

        <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} onChange={handleFileChange} className="hidden" />

        {onUploadPhoto && (
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full mt-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white">
            {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</> : <><Upload className="w-4 h-4 mr-2" /> Subir Tu Propio Flyer</>}
          </Button>
        )}

        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1 h-px bg-purple-500/20" />
          <span className="text-[10px] text-muted-foreground">o elige de la biblioteca</span>
          <div className="flex-1 h-px bg-purple-500/20" />
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="buscar por nombre o categoría..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-muted/30" />
        </div>

        <div className="mt-4 overflow-y-auto flex-1">
          {isLoading && flyers.length === 0 ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-muted-foreground animate-spin" /></div>
          ) : visibleFlyers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No se encontraron flyers</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {displayedFlyers.map(f => (
                <button key={f.id} onClick={() => { onSelectPhoto(f.image_url); onClose(); }} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border hover:scale-105 transition-transform">
                  <img src={f.image_url} alt={f.title} className="absolute inset-0 w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {displayedFlyers.length < visibleFlyers.length && (
            <Button variant="secondary" size="sm" onClick={() => setVisibleCount(c => c + 20)} className="w-full mt-4">Ver más</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlyerLibraryModal;