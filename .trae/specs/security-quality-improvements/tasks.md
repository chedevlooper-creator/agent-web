# Tasks: Agent Web Güvenlik ve Kalite İyileştirme

## Görevler

- [x] 1: Server-Side API Key Yönetimi
  - [x] 1.1: API key environment variable olarak saklama desteği ekle
  - [x] 1.2: Admin panel'den key girişi için server-side encrypted storage ekle
  - [x] 1.3: Client-side store'dan apiKey kaldır (ui'den)
  - [x] 1.4: Chat API route'u server-side key kullanacak şekilde güncelle

- [x] 2: Rate Limiting Middleware
  - [x] 2.1: Rate limiting utility/helper oluştur
  - [x] 2.2: Chat API route'una rate limiting uygula (20 req/dk)
  - [x] 2.3: Tool execution API'lerine rate limiting uygula
  - [x] 2.4: Rate limit exceeded response format tanımla

- [x] 3: Zod Input Validation
  - [x] 3.1: Shared Zod schemas dosyası oluştur
  - [x] 3.2: Chat API request schema tanımla
  - [x] 3.3: Tool execution schema tanımla
  - [x] 3.4: Memory/Skills/Cron schemas tanımla
  - [x] 3.5: Tüm API route'larında validation uygula

- [x] 4: Path Traversal Koruması
  - [x] 4.1: realpath() kullanarak symlink çözümleme ekle
  - [x] 4.2: File tool'da path validation güçlendir
  - [x] 4.3: Terminal tool'da cwd validation ekle
  - [x] 4.4: Path traversal test cases yaz

- [x] 5: Connection Pooling
  - [x] 5.1: Drizzle config'de connection pooling aktif et
  - [x] 5.2: Pool size ve timeout ayarları yapılandır
  - [x] 5.3: Connection leak detection ekle

- [x] 6: Error Handling Standardization
  - [x] 6.1: AppError class oluştur (codes, details)
  - [x] 6.2: Error response format standardize et
  - [x] 6.3: Global error handler middleware ekle
  - [x] 6.4: Tüm API route'larda yeni error format kullan

- [x] 7: Type Deduplication
  - [x] 7.1: packages/core/src/types.ts'i singleton source yap
  - [x] 7.2: Frontend store types'ı core types'dan import et
  - [x] 7.3: Duplicate type tanımlarını kaldır

- [x] 8: Magic Strings → Constants
  - [x] 8.1: Provider constants tanımla
  - [x] 8.2: Toolset constants tanımla
  - [x] 8.3: Status constants tanımla
  - [x] 8.4: String literal yerine constants kullan

## Task Dependencies

- Görev 1 (API Key) → Görev 5 (Connection Pooling) paralel çalışabilir
- Görev 3 (Zod) → Görev 6 (Error Handling) paralel çalışabilir
- Görev 4 (Path Traversal) → Görev 2 (Rate Limiting) bağımsız
- Görev 7 (Types) → Görev 8 (Constants) bağımlı

## Tamamlanma Kriterleri

- [x] Tüm API route'larda rate limiting aktif
- [x] Tüm user input'lar Zod ile validate ediliyor
- [x] Path traversal saldırıları test ile doğrulanmış şekilde engelleniyor
- [x] API key'ler client-side'ta saklanmıyor
- [x] Connection pooling aktif ve yapılandırılmış
- [x] Error responses `{ error, code, details }` formatında
- [x] Type'lar tek kaynaktan import ediliyor
- [x] Magic strings constants ile değiştirilmiş
