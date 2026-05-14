# Agent Web Güvenlik ve Kalite İyileştirme Spec

## Why

Proje analiz raporunda tespit edilen kritik güvenlik açıkları, performans sorunları ve kod kalitesi eksiklikleri üretim ortamı için risk oluşturmaktadır. Bu spec, tüm bu kritik alanları ele alarak uygulamanın güvenliğini, performansını ve bakım kolaylığını artırmayı hedeflemektedir.

## What Changes

### Güvenlik İyileştirmeleri
- API Key yönetiminin server-side'a taşınması (HttpOnly cookie veya server-side storage)
- Rate limiting middleware eklenmesi (express-rate-limit)
- Input validation için Zod schemas eklenmesi
- Path traversal korumasının güçlendirilmesi (realpath(), symlink kontrolü)
- Command injection koruması (whitelist approach)

### Performans İyileştirmeleri
- Database query optimization (N+1 problemi çözümü)
- Connection pooling yapılandırması
- Streaming response için backpressure handling
- File search için streaming/chunked processing
- Zustand persist middleware optimization

### Kod Kalitesi İyileştirmeleri
- Merkezi type tanımları (types.ts singleton pattern)
- Zod schemas ile input validation
- Consistent error handling (Result pattern veya custom error class)
- Magic strings yerine const/enum kullanımı

## Impact

**Affected Specs:**
- Chat Engine: API key artık client-side'ta saklanmayacak
- Tool Registry: Input validation ve sanitization eklenecek
- Memory Manager: Connection pooling desteği
- Frontend: Error boundaries ve loading states

**Affected Code:**
- `apps/web/lib/store.ts` - API key removal
- `apps/web/app/api/*` - Rate limiting + validation
- `packages/core/src/tools/terminal.ts` - Security hardening
- `packages/core/src/tools/file.ts` - Path traversal fix
- `packages/db/src/index.ts` - Connection pooling
- `packages/core/src/types.ts` - Centralized types

## ADDED Requirements

### Requirement: Server-Side API Key Management

Sistem, API key'leri client-side localStorage yerine server-side ortam değişkenlerinde veya encrypted session storage'de saklamalıdır.

#### Scenario: API Key Configuration
- **WHEN** admin yeni bir API key kaydetmek istediğinde
- **THEN** key server-side encrypted storage'de saklanmalı, client sadece masked version görmeli

#### Scenario: Chat Request
- **WHEN** kullanıcı chat isteği gönderdiğinde
- **THEN** API key backend'den okunmalı, client'a gönderilmemeli

#### Scenario: Session Validation
- **WHEN** kullanıcı oturum açtığında
- **THEN** session token HttpOnly cookie'de saklanmalı

### Requirement: Rate Limiting

API endpoint'leri rate limiting ile korunmalıdır.

#### Scenario: Excessive Requests
- **WHEN** bir IP 60 saniyede 100'den fazla istek yaparsa
- **THEN** 429 Too Many Requests dönmeli

#### Scenario: Chat Rate Limit
- **WHEN** bir kullanıcı 1 dakikada 20'den fazla chat mesajı gönderirse
- **THEN** rate limit aşıldı uyarısı gösterilmeli

### Requirement: Input Validation with Zod

Tüm API endpoint'leri Zod schemas ile input validation yapmalıdır.

#### Scenario: Invalid Chat Request
- **WHEN** kullanıcı eksik fields ile chat isteği gönderirse
- **THEN** 400 Bad Request + validation errors dönmeli

#### Scenario: Invalid Tool Arguments
- **WHEN** tool çağrısı geçersiz argument ile yapılırsa
- **THEN** validation error client'a gösterilmeli

### Requirement: Path Traversal Protection

File ve terminal tool'ları path traversal saldırılarına karşı korunmalıdır.

#### Scenario: Symlink Attack
- **WHEN** kullanıcı symbolic link içeren bir path'e erişmeye çalışırsa
- **THEN** erişim reddedilmeli

#### Scenario: Absolute Path Bypass
- **WHEN** kullanıcı `/etc/passwd` gibi mutlak path ile erişmeye çalışırsa
- **THEN** erişim reddedilmeli

### Requirement: Database Connection Pooling

Database işlemleri connection pooling kullanmalıdır.

#### Scenario: High Traffic
- **WHEN** sistem yüksek trafik alıyorsa
- **THEN** connection pool sayesinde yeni connection oluşturma overhead'i olmamalı

### Requirement: Streaming Backpressure

Frontend streaming response'ları doğru şekilde handle etmelidir.

#### Scenario: Slow Consumer
- **WHEN** network yavaşsa veya client yavaş tüketiyorsa
- **THEN** server backpressure uygulamalı, client'a backpressure sinyali gönderilmeli

## MODIFIED Requirements

### Requirement: Tool Execution Security

**Mevcut:** Terminal tool sadece basit pattern matching ile command sanitize ediyor.

**Yeni:** Command whitelist + arg validation + timeout enforcement.

#### Scenario: Dangerous Command
- **WHEN** kullanıcı `rm -rf /` gibi tehlikeli komut çalıştırmak isterse
- **THEN** komut engellenmeli ve security loguna kaydedilmeli

### Requirement: Error Handling Standardization

**Mevcut:** Her yerde farklı error handling pattern'i var.

**Yeni:** Consistent error response format + error codes.

#### Scenario: API Error
- **WHEN** API hata dönerse
- **THEN** tüm hatalar `{ error: string, code: string, details?: unknown }` formatında dönmeli

## REMOVED Requirements

### Requirement: Client-Side API Key Storage

**Reason**: XSS saldırıları ile API key çalınabilir. Güvenlik riski.

**Migration**: Server-side environment variables veya encrypted storage kullanılmalı.

## Implementation Notes

### Teknoloji Stack
- Rate Limiting: `express-rate-limit` veya custom Next.js middleware
- Validation: `zod` library
- Connection Pooling: Drizzle ORM built-in pooling
- Error Handling: Custom `AppError` class

### Migration Strategy
1. Feature flag ile gradual rollout
2. Client-side key removal son adımda
3. Geriye dönük uyumluluk korunmalı (legacy endpoint'ler çalışmalı)
