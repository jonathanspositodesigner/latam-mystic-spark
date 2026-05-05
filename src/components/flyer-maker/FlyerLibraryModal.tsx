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

      const { data: libItems } = await supabase
        .from('ai_tool_library_items' as any)
        .select('source_id, category_id, display_order')
        .eq('tool_slug', TOOL_SLUG)
        .eq('is_visible', true)
        .order('display_order', { ascending: true })
        .limit(1000);

      if (!libItems || libItems.length === 0) { setFlyers([]); return; }
      const sourceIds = (libItems as any[]).map(i => i.source_id);

      const { data: artesData } = await supabase
        .from('admin_artes' as any)
        .select('id, title, image_url, category')
        .in('id', sourceIds);

      const catById = new Map((libItems as any[]).map(i => [i.source_id, i.category_id]));
      const merged: FlyerItem[] = (artesData || []).map(a => ({
        id: a.id,
        title: a.title,
        image_url: a.image_url,
        category: a.category,
        category_id: catById.get(a.id) ?? null,
      }));

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

  const displayedFlyers = useMemo(() => visibleFlyers.slice(0, visibleCount), [visibleFlyers, visibleCount]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = event.target.files?.[0];
    if (!rawFile || !onUploadPhoto) return;
    if (!isAcceptedImage(rawFile)) {
      toast.error('Selecciona una imagen válida (JPG, PNG, WEBP o HEIC).');
      return;
    }
    setIsUploading(true);
    try {
      const file = await ensureBrowserCompatibleImage(rawFile);
      const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true });
      const reader = new FileReader();
      reader.onloadend = () => { onUploadPhoto(reader.result as string, compressed as unknown as File); onClose(); };
      reader.readAsDataURL(compressed);
    } catch (err) {
      console.error('[FlyerLibrary] Upload error:', err);
      toast.error('Error al procesar la imagen.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-background border border-purple-500/40 text-foreground max-h-[85vh] overflow-hidden flex flex-col p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
            Biblioteca de Flyers
          </DialogTitle>
        </DialogHeader>
        <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} onChange={handleFileChange} className="hidden" />
        {isLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
          <div className="grid grid-cols-3 gap-3 overflow-y-auto">
            {displayedFlyers.map(flyer => (
              <button key={flyer.id} onClick={() => { onSelectPhoto(flyer.image_url); onClose(); }} className="aspect-[3/4] rounded-lg overflow-hidden border">
                <img src={flyer.image_url} alt={flyer.title} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FlyerLibraryModal;