# Terminal Tool Performans Refaktörü — Tasarım

## Bağlam

`@agent-web/core` içindeki terminal aracı, şu an `child_process.exec` ile komut çalıştırır ve stdout/stderr çıktısını buffer’layarak tek seferde döndürür. Bu yaklaşım:

- Büyük çıktılarda buffer limitine çabuk takılabilir
- Süreç I/O’su tamamlanana kadar çıktı üretimini geciktirir
- `exec` tarafındaki “tam buffer” modeli nedeniyle bellek ve gecikme açısından dezavantajlıdır

Bu tasarım, dış arayüzü değiştirmeden (modelin kullandığı tool parametreleri sabit kalacak şekilde) daha verimli bir yürütme modeli sunar.

## Hedefler

- Komut çalıştırma gecikmesini azaltmak ve çıktı üretimini daha akışkan hale getirmek
- Çıktı boyutu ve zaman aşımı sınırlarını daha deterministik uygulamak
- Mevcut tool sözleşmesini korumak: `{ command, timeout?, cwd? }`
- Mevcut çıktı formatını (stdout/stderr/exit etiketleri) korumak

## Hedef Dışı

- Shell’siz “structured” mod (ör. `program + args[]`) eklemek
- Güvenlik sertleştirmeleri (whitelist, arg doğrulama vb.) eklemek
- Terminal tool’un UI/streaming protokolünü değiştirmek

## Önerilen Yaklaşım

### Yürütme Modeli

- `exec` yerine `child_process.spawn` kullanılacak.
- Shell davranışı korunacak: non-Windows ortamda `/bin/bash` ile çalıştırılacak.
- `cwd` verilmişse kullanılacak; yoksa `process.cwd()`.

### Çıktı Yakalama ve Limit

- stdout/stderr event’leri parça parça (chunk) okunacak ve toplanacak.
- Toplam çıktı için birleşik bir byte limiti uygulanacak (mevcut `MAX_OUTPUT` ile uyumlu, şu an 1MB).
- Limit aşılırsa süreç sonlandırılacak ve dönüş metnine sabit bir işaret eklenecek: `[truncated] output exceeded limit (1MB)`.

### Zaman Aşımı

- `timeout` clamp mantığı korunacak: varsayılan 30s, min 1s, max 120s.
- Süre aşılırsa süreç öldürülecek ve mevcut formatla uyumlu bir timeout mesajı dönülecek.

### Çıkış Formatı

Mevcut format korunur:

- stdout varsa: `[stdout]\n...`
- stderr varsa: `[stderr]\n...`
- Hata/çıkış kodu gerekiyorsa: `[exit] code=...: ...`

Amaç; UI ve modelin halihazırda alıştığı metin formatında kırılma yaratmamaktır.

## Hata Durumları

- Komut non-zero exit code ile biterse: stdout/stderr toplanır; ayrıca `[exit]` satırı eklenir.
- Spawn başarısız olursa (örn. shell bulunamazsa): `[exit]` satırı ile hata mesajı dönülür.
- Çıktı limiti aşılırsa: süreç sonlandırılır ve truncation bilgisi ile döner.
- Timeout olursa: süreç sonlandırılır ve timeout mesajı ile döner.

## Geriye Dönük Uyumluluk

- Tool adı (`terminal`) ve parametre şeması değişmez.
- `timeout` ve `cwd` davranışı korunur.
- Dönüş metni etiketleri korunur.

## Test ve Doğrulama

- Küçük komut: `echo` gibi hızlı çıktıda format doğrulama
- stderr üreten komut: `ls missing-file` gibi; `[stderr]` blok doğrulama
- Büyük çıktı: `yes | head -n ...` gibi; truncation ve süreç sonlandırma doğrulama
- Timeout: `sleep` gibi; timeout mesajı ve süreç öldürme doğrulama

## Rollout

- Tek adımda mevcut implementasyonun yerine geçer (feature flag yok).
- Beklenen risk: çok uzun süren veya çok büyük çıktı üreten komutlarda, önceki davranışa göre daha erken “kesme” (truncation) görülebilir; bu beklenen ve kontrollü bir davranıştır.
