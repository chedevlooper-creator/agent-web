# Tool Panel İyileştirme Planı

## Hedef

Chat arayüzünde tool çağrıları için daha iyi görsel geri bildirim, durum göstergeleri, collapsible kartlar, performans metrikleri ve onay iş akışı entegrasyonu sağlamak.

## Mevcut Durum

- `chat-interface.tsx`: Basit ToolCallCard bileşeni (expandable, copy butonu)
- `tool-call-panel.tsx`: Daha detaylı ayrı bir panel (status icons, duration)
- `approval.ts`: Tehlikeli komutlar için onay sistemi
- `stream-parser.ts`: Tool-call ve tool-result event'leri işliyor

## Planlanan İyileştirmeler

### 1. Unified Tool Panel Bileşeni

**Dosya:** `apps/web/components/tool-panel.tsx` (yeni)

Yeni bir birleşik `ToolPanel` bileşeni oluşturulacak:
- Tool çağrı listesi
- Her tool için collapsible kart
- Durum göstergeleri (running/success/error)
- Süre (duration) gösterimi
- Argüman ve sonuç görüntüleme
- Onay bekleyen tool'lar için modal

### 2. Tool Onay Sistemi Entegrasyonu

**Dosya:** `apps/web/components/tool-approval-modal.tsx` (yeni)

- Tehlikeli komutlar için onay modalı
- Komut önizleme
- Reddet/Kabul et seçenekleri
- "Bu tür komutları her zaman engelle" seçeneği

### 3. Streaming Status Indicators

**Dosya:** `apps/web/components/chat/chat-interface.tsx` (güncelleme)

- Tool çalışırken spinner animasyonu
- Tamamlanan tool'ların yeşil check işareti
- Hata olan tool'ların kırmızı X işareti
- Tool sonuçlarının real-time gösterimi

### 4. Performance Metrics

**Dosya:** `apps/web/lib/store.ts` (güncelleme)

Store'a eklenecek:
- `toolExecutions`: Aktif tool çalışmalarının listesi
- Her tool için başlangıç zamanı, süre

### 5. API Endpoint Güncellemesi

**Dosya:** `apps/web/app/api/chat/route.ts` (güncelleme)

- Tool onay durumu için endpoint
- Onay reddedildiğinde tool çalıştırmama

## Uygulama Adımları

### Adım 1: ToolPanel Bileşeni Oluştur
- [ ] Yeni `ToolPanel` bileşeni oluştur
- [ ] `ToolCallCard` alt bileşeni ekle
- [ ] Durum ikonları (loading, success, error)
- [ ] Collapsible yapı
- [ ] Süre gösterimi

### Adım 2: Tool Onay Modalı
- [ ] `ToolApprovalModal` bileşeni oluştur
- [ ] Komut önizleme
- [ ] Kabul/Reddet işlemleri
- [ ] Store'da onay durumu yönetimi

### Adım 3: ChatInterface Güncellemesi
- [ ] Mevcut ToolCallCard'ı yeni ToolPanel ile değiştir
- [ ] Tool onay modal'ını entegre et
- [ ] Streaming sırasında durum güncellemeleri

### Adım 4: Store Güncellemesi
- [ ] `toolExecutions` state'i ekle
- [ ] `pendingApprovals` state'i ekle
- [ ] Action'lar ekle

### Adım 5: API Entegrasyonu
- [ ] Onay endpoint'i oluştur veya güncelle
- [ ] Frontend onay modal'ını API'ye bağla

## Etkilenecek Dosyalar

| Dosya | İşlem |
|-------|-------|
| `apps/web/components/tool-panel.tsx` | Oluştur |
| `apps/web/components/tool-approval-modal.tsx` | Oluştur |
| `apps/web/components/chat/chat-interface.tsx` | Güncelle |
| `apps/web/lib/store.ts` | Güncelle |
| `apps/web/app/api/chat/route.ts` | Güncelle |

## Bağımlılıklar

- Mevcut `approval.ts` sistemi kullanılacak
- `lucide-react` ikonları kullanılacak
- Mevcut `Card`, `Button` gibi UI bileşenleri kullanılacak

## Riskler

- Mevcut tool-call akışının bozulmaması gerekiyor
- Streaming sırasında UI freeze olmaması için optimize edilmeli
- Onay iş akışı backend ve frontend arasında senkronize olmalı
