# Tool Panel ve Onay Sistemi Tamamlama Planı

## Özet
Mevcut durumda `ToolPanel`, `ToolApprovalModal` bileşenleri oluşturulmuş ve `store.ts` içerisine gerekli state tanımlamaları (toolExecutions, pendingApprovals) eklenmiştir. Ancak, `chat-interface.tsx` bu state'leri global store üzerinden kullanmak yerine yerel (local) state ile yönetmektedir. Ayrıca, backend tarafında (Vercel AI SDK) tool'lar anında çalıştırılmakta olup, gerçek bir "bekletme ve onay alma" mekanizması (Server-to-Client) tam olarak kurulmamıştır.

Bu plan, UI bileşenlerinin global store'a bağlanmasını ve backend tool çalıştırma mekanizmasının (Approval System) gerçekten çalışır hale getirilmesini kapsar.

## Mevcut Durum Analizi
1. **Frontend UI:** `ToolPanel` ve `ToolApprovalModal` bileşenleri hazır.
2. **State Yönetimi:** `store.ts` içinde `toolExecutions` ve `pendingApprovals` mevcut.
3. **Sorun 1 (Frontend):** `chat-interface.tsx` hala `useState` ile `toolCalls` ve `pendingApproval` tutuyor. Global store'a senkronize edilmiyor.
4. **Sorun 2 (Backend):** `@agent-web/core/src/chat/engine.ts` içindeki `execute` fonksiyonu, `t.handler(args)` çağrısını anında yapıyor. Frontend onayı beklenmiyor.

## Önerilen Değişiklikler

### 1. Frontend State Entegrasyonu
- **Dosya:** `apps/web/components/chat/chat-interface.tsx`
- **Ne Yapılacak:**
  - Yerel `toolCalls` ve `pendingApproval` state'leri kaldırılacak.
  - Bunun yerine `useChatStore` üzerinden `toolExecutions`, `pendingApprovals`, `addToolExecution`, `updateToolExecution`, `addPendingApproval`, `removePendingApproval` kullanılacak.
  - Streaming esnasında gelen `tool-call` ve `tool-result` event'leri global store'a yazılacak.

### 2. Backend Tool Onay (Approval) Mekanizması
- **Dosya:** `packages/core/src/chat/engine.ts` ve `packages/core/src/tools/approval.ts`
- **Ne Yapılacak:**
  - `engine.ts` içindeki `execute` fonksiyonu, tehlikeli bir komut algıladığında hemen `t.handler` çalıştırmak yerine, bir veritabanı tablosuna (veya memory/redis) pending approval durumunu yazacak.
  - Backend, frontend'in onay endpoint'ine istek atmasını beklemek üzere bir polling (örn. `while(status === 'pending') await sleep(1000)`) veya event emitter mekanizması kullanacak.

### 3. API Endpoint Güncellemesi (Onaylama için)
- **Dosya:** `apps/web/app/api/chat/approve/route.ts` (Yeni dosya eklenebilir veya chat route'u güncellenebilir)
- **Ne Yapılacak:**
  - Frontend'den gelen `approve` veya `reject` komutlarını alıp backend'deki bekleyen (paused) tool execution'ı devam ettirecek endpoint eklenecek.

### 4. Drizzle Schema Güncellemesi (Opsiyonel/Gerekli)
- **Dosya:** `packages/db/src/schema.ts`
- **Ne Yapılacak:**
  - Backend'in polling yapabilmesi için `pending_approvals` tablosu oluşturulacak (id, tool_name, arguments, status: pending/approved/rejected, session_id).

## Varsayımlar ve Kararlar
- Proje yerel/self-hosted olarak tasarlandığı için backend tarafında basit bir polling (veritabanı tablosu üzerinden) veya global EventEmitter bekletme süreci Vercel timeout sınırlarına (15-60s) takılmadan çalışabilir.
- Global Store (Zustand) kullanılarak component'ler arası (örneğin context panel veya sidebar) tool execution durumları paylaşıma açılmış olacaktır.

## Doğrulama Adımları
1. Chat arayüzünden `rm -rf /` gibi tehlikeli bir komut gönderilecek.
2. Backend bu komutu çalıştırmayıp UI'a `tool-call` eventi atacak.
3. UI'da modal açılacak ve komut beklemeye alınacak.
4. "Reject" edildiğinde backend `[Tool Error: Rejected by user]` şeklinde AI'a geri dönecek.
5. "Approve" edildiğinde komut gerçekten çalıştırılacak ve sonuç UI'a stream edilecek.
6. Tüm tool call'lar Context Panel'deki Tool tabında veya Chat mesajlarının altındaki ToolPanel'de senkron şekilde görülebilecek.
