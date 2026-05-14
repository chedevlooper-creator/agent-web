# Tasks: Agent Web Güvenlik ve Kalite İyileştirme

## Görevler

- [ ] 1: Server-Side API Key Yönetimi
  - [ ] 1.1: API key environment variable olarak saklama desteği ekle
  - [ ] 1.2: Admin panel'den key girişi için server-side encrypted storage ekle
  - [ ] 1.3: Client-side store'dan apiKey kaldır (ui'den)
  - [ ] 1.4: Chat API route'u server-side key kullanacak şekilde güncelle

- [ ] 2: Rate Limiting Middleware
  - [ ] 2.1: Rate limiting utility/helper oluştur
  - [ ] 2.2: Chat API route'una rate limiting uygula (20 req/dk)
  - [ ] 2.3: Tool execution API'lerine rate limiting uygula
  - [ ] 2.4: Rate limit exceeded response format tanımla

- [ ] 3: Zod Input Validation
  - [ ] 3.1: Shared Zod schemas dosyası oluştur
  - [ ] 3.2: Chat API request schema tanımla
  - [ ] 3.3: Tool execution schema tanımla
  - [ ] 3.4: Memory/Skills/Cron schemas tanımla
  - [ ] 3.5: Tüm API route'larında validation uygula

- [ ] 4: Path Traversal Koruması
  - [ ] 4.1: realpath() kullanarak symlink çözümleme ekle
  - [ ] 4.2: File tool'da path validation güçlendir
  - [ ] 4.3: Terminal tool'da cwd validation ekle
  - [ ] 4.4: Path traversal test cases yaz

- [ ] 5: Connection Pooling
  - [ ] 5.1: Drizzle config'de connection pooling aktif et
  - [ ] 5.2: Pool size ve timeout ayarları yapılandır
  - [ ] 5.3: Connection leak detection ekle

- [ ] 6: Error Handling Standardization
  - [ ] 6.1: AppError class oluştur (codes, details)
  - [ ] 6.2: Error response format standardize et
  - [ ] 6.3: Global error handler middleware ekle
  - [ ] 6.4: Tüm API route'larda yeni error format kullan

- [ ] 7: Type Deduplication
  - [ ] 7.1: packages/core/src/types.ts'i singleton source yap
  - [ ] 7.2: Frontend store types'ı core types'dan import et
  - [ ] 7.3: Duplicate type tanımlarını kaldır

- [ ] 8: Magic Strings → Constants
  - [ ] 8.1: Provider constants tanımla
  - [ ] 8.2: Toolset constants tanımla
  - [ ] 8.3: Status constants tanımla
  - [ ] 8.4: String literal yerine constants kullan

## Task Dependencies

- Görev 1 (API Key) → Görev 5 (Connection Pooling) paralel çalışabilir
- Görev 3 (Zod) → Görev 6 (Error Handling) paralel çalışabilir
- Görev 4 (Path Traversal) → Görev 2 (Rate Limiting) bağımsız
- Görev 7 (Types) → Görev 8 (Constants) bağımlı

## Tamamlanma Kriterleri

- [ ] Tüm API route'larda rate limiting aktif
- [ ] Tüm user input'lar Zod ile validate ediliyor
- [ ] Path traversal saldırıları test ile doğrulanmış şekilde engelleniyor
- [ ] API key'ler client-side'ta saklanmıyor
- [ ] Connection pooling aktif ve yapılandırılmış
- [ ] Error responses `{ error, code, details }` formatında
- [ ] Type'lar tek kaynaktan import ediliyor
- [ ] Magic strings constants ile değiştirilmiş
