# 🔐 Giriş Ekranı - Backend Hata Mesajları Entegrasyonu

## 📋 Özet

Giriş ekranında kullanıcı adı (e-posta) veya şifre yanlış girildiğinde, backend'den gelen detaylı hata mesajlarına göre alan bazlı uyarılar gösterilir.

---

## 🎯 Özellikler

- ✅ **Alan Bazlı Hata Mesajları**: E-posta veya şifre için ayrı uyarılar
- ✅ **Backend Entegrasyonu**: Backend'den gelen hata tiplerine göre otomatik mesaj gösterimi
- ✅ **Kullanıcı Dostu**: Hangi alanın yanlış olduğu net bir şekilde belirtilir
- ✅ **Modern Tasarım**: Doping Hafıza'ya uygun görsel tasarım

---

## 🔌 Backend API Yapısı

### 1. Giriş Endpoint'i

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "kullanici@example.com",
  "password": "sifre123"
}
```

---

## 📤 Backend'den Gönderilecek Hata Formatları

Frontend, aşağıdaki formatları destekler. Backend'den bu formatlardan birini kullanarak hata gönderebilirsiniz.

**⚠️ ÖNEMLİ:** Backend'den Spring Boot'un default exception formatı (`BadCredentialsException`) geliyorsa, frontend bunu otomatik olarak handle eder. Ancak daha iyi kullanıcı deneyimi için önerilen formatları kullanın.

### Format 1: `errorType` ile (Önerilen)

Backend'den gönderilecek response:

```json
{
  "errorType": "INVALID_EMAIL",
  "message": "Bu e-posta adresi bulunamadı."
}
```

veya

```json
{
  "errorType": "INVALID_PASSWORD",
  "message": "Şifre yanlış."
}
```

**Desteklenen `errorType` değerleri:**
- `INVALID_EMAIL` → E-posta alanında hata gösterilir
- `USER_NOT_FOUND` → E-posta alanında hata gösterilir
- `INVALID_PASSWORD` → Şifre alanında hata gösterilir
- `WRONG_PASSWORD` → Şifre alanında hata gösterilir
- `INVALID_CREDENTIALS` → Her iki alanda da hata gösterilir (veya `field` ile belirtilirse sadece o alanda)

**Örnek Java Spring Boot Controller:**

```java
@PostMapping("/api/auth/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    try {
        // Kullanıcıyı bul
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> {
                Map<String, String> error = new HashMap<>();
                error.put("errorType", "INVALID_EMAIL");
                error.put("message", "Bu e-posta adresi bulunamadı.");
                return new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, 
                    new ObjectMapper().writeValueAsString(error)
                );
            });
        
        // Şifreyi kontrol et
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            Map<String, String> error = new HashMap<>();
            error.put("errorType", "INVALID_PASSWORD");
            error.put("message", "Şifre yanlış.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }
        
        // Başarılı giriş
        String token = jwtTokenProvider.generateToken(user);
        return ResponseEntity.ok(new LoginResponse(token, user));
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("errorType", "INVALID_CREDENTIALS");
        error.put("message", "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
}
```

---

### Format 2: `field` ile

Backend'den gönderilecek response:

```json
{
  "field": "email",
  "message": "Bu e-posta adresi bulunamadı."
}
```

veya

```json
{
  "field": "password",
  "message": "Şifre yanlış."
}
```

**Örnek Java Spring Boot Controller:**

```java
@PostMapping("/api/auth/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    User user = userRepository.findByEmail(request.getEmail())
        .orElse(null);
    
    if (user == null) {
        Map<String, String> error = new HashMap<>();
        error.put("field", "email");
        error.put("message", "Bu e-posta adresi bulunamadı.");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
    
    if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
        Map<String, String> error = new HashMap<>();
        error.put("field", "password");
        error.put("message", "Şifre yanlış.");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
    
    // Başarılı giriş
    String token = jwtTokenProvider.generateToken(user);
    return ResponseEntity.ok(new LoginResponse(token, user));
}
```

---

### Format 3: `errorType` + `field` kombinasyonu

Daha detaylı kontrol için her ikisini birlikte kullanabilirsiniz:

```json
{
  "errorType": "INVALID_CREDENTIALS",
  "field": "email",
  "message": "Bu e-posta adresi bulunamadı."
}
```

veya

```json
{
  "errorType": "INVALID_CREDENTIALS",
  "field": "password",
  "message": "Şifre yanlış."
}
```

---

## 🎨 Frontend Davranışı

### Senaryo 1: E-posta Yanlış

**Backend Response:**
```json
{
  "errorType": "INVALID_EMAIL",
  "message": "Bu e-posta adresi bulunamadı."
}
```

**Frontend Gösterimi:**
- ✅ E-posta input'unun altında kırmızı uyarı kutusu
- ✅ "⚠ Bu e-posta adresi bulunamadı." mesajı
- ✅ E-posta input'u kırmızı border ile vurgulanır

### Senaryo 2: Şifre Yanlış

**Backend Response:**
```json
{
  "errorType": "INVALID_PASSWORD",
  "message": "Şifre yanlış."
}
```

**Frontend Gösterimi:**
- ✅ Şifre input'unun altında kırmızı uyarı kutusu
- ✅ "⚠ Şifre yanlış." mesajı
- ✅ Şifre input'u kırmızı border ile vurgulanır

### Senaryo 3: Her İkisi de Yanlış (Genel Mesaj)

**Backend Response:**
```json
{
  "errorType": "INVALID_CREDENTIALS",
  "message": "E-posta veya şifre hatalı."
}
```

**Frontend Gösterimi:**
- ✅ Her iki input'un altında da aynı mesaj gösterilir
- ✅ Her iki input da kırmızı border ile vurgulanır

---

## 🔧 Backend Örnek Implementasyon (Java Spring Boot)

### 1. Error Response DTO Oluştur

```java
public class AuthErrorResponse {
    private String errorType;
    private String field;
    private String message;
    
    // Constructors
    public AuthErrorResponse(String errorType, String message) {
        this.errorType = errorType;
        this.message = message;
    }
    
    public AuthErrorResponse(String errorType, String field, String message) {
        this.errorType = errorType;
        this.field = field;
        this.message = message;
    }
    
    // Getters and Setters
    public String getErrorType() { return errorType; }
    public void setErrorType(String errorType) { this.errorType = errorType; }
    
    public String getField() { return field; }
    public void setField(String field) { this.field = field; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

### 2. Login Controller Güncelle

```java
@PostMapping("/api/auth/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    // 1. E-posta kontrolü
    Optional<User> userOpt = userRepository.findByEmail(request.getEmail());
    
    if (userOpt.isEmpty()) {
        AuthErrorResponse error = new AuthErrorResponse(
            "INVALID_EMAIL",
            "email",
            "Bu e-posta adresi bulunamadı."
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
    
    User user = userOpt.get();
    
    // 2. Şifre kontrolü
    if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
        AuthErrorResponse error = new AuthErrorResponse(
            "INVALID_PASSWORD",
            "password",
            "Şifre yanlış."
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
    
    // 3. Başarılı giriş
    String token = jwtTokenProvider.generateToken(user);
    LoginResponse response = new LoginResponse(token, user);
    return ResponseEntity.ok(response);
}
```

### 3. Exception Handler (Opsiyonel)

Global exception handler ile daha temiz kod:

```java
@ControllerAdvice
public class AuthExceptionHandler {
    
    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<AuthErrorResponse> handleUserNotFound(UsernameNotFoundException ex) {
        AuthErrorResponse error = new AuthErrorResponse(
            "INVALID_EMAIL",
            "email",
            "Bu e-posta adresi bulunamadı."
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
    
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<AuthErrorResponse> handleBadCredentials(BadCredentialsException ex) {
        AuthErrorResponse error = new AuthErrorResponse(
            "INVALID_PASSWORD",
            "password",
            "Şifre yanlış."
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
}
```

---

## 🐍 Python/Flask Örnek

```python
from flask import Flask, request, jsonify
from werkzeug.security import check_password_hash

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    # Kullanıcıyı bul
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({
            'errorType': 'INVALID_EMAIL',
            'field': 'email',
            'message': 'Bu e-posta adresi bulunamadı.'
        }), 401
    
    # Şifreyi kontrol et
    if not check_password_hash(user.password, password):
        return jsonify({
            'errorType': 'INVALID_PASSWORD',
            'field': 'password',
            'message': 'Şifre yanlış.'
        }), 401
    
    # Başarılı giriş
    token = generate_token(user)
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200
```

---

## 🟢 Node.js/Express Örnek

```javascript
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Kullanıcıyı bul
  const user = await User.findOne({ where: { email } });
  
  if (!user) {
    return res.status(401).json({
      errorType: 'INVALID_EMAIL',
      field: 'email',
      message: 'Bu e-posta adresi bulunamadı.'
    });
  }
  
  // Şifreyi kontrol et
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({
      errorType: 'INVALID_PASSWORD',
      field: 'password',
      message: 'Şifre yanlış.'
    });
  }
  
  // Başarılı giriş
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      ad: user.ad,
      soyad: user.soyad
    }
  });
});
```

---

## ✅ Test Senaryoları

### Test 1: Yanlış E-posta
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"yanlis@email.com","password":"123456"}'
```

**Beklenen Response:**
```json
{
  "errorType": "INVALID_EMAIL",
  "field": "email",
  "message": "Bu e-posta adresi bulunamadı."
}
```

### Test 2: Yanlış Şifre
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dogru@email.com","password":"yanlisSifre"}'
```

**Beklenen Response:**
```json
{
  "errorType": "INVALID_PASSWORD",
  "field": "password",
  "message": "Şifre yanlış."
}
```

### Test 3: Başarılı Giriş
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dogru@email.com","password":"dogruSifre"}'
```

**Beklenen Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "dogru@email.com",
    "ad": "Ahmet",
    "soyad": "Yılmaz"
  }
}
```

---

## 📝 Notlar

1. **Güvenlik**: Kullanıcı adı veya şifre yanlış olduğunda, hangi alanın yanlış olduğunu belirtmek güvenlik açısından sorun yaratabilir. Ancak modern uygulamalarda bu yaklaşım kullanıcı deneyimini iyileştirir.

2. **Alternatif Yaklaşım**: Eğer güvenlik endişeniz varsa, her iki durumda da genel bir mesaj gösterebilirsiniz:
   ```json
   {
     "errorType": "INVALID_CREDENTIALS",
     "message": "E-posta veya şifre hatalı."
   }
   ```

3. **Rate Limiting**: Brute force saldırılarına karşı rate limiting eklemeyi unutmayın.

4. **Logging**: Hatalı giriş denemelerini loglamak güvenlik için önemlidir.

---

## 🔄 Spring Boot Exception Formatı Desteği

Frontend, Spring Boot'un default exception formatını da destekler:

**Backend'den gelen format:**
```json
{
  "error": "Bad credentials",
  "status": 500,
  "type": "BadCredentialsException"
}
```

**Frontend davranışı:**
- `BadCredentialsException` → Şifre alanında hata gösterilir
- `UsernameNotFoundException` → E-posta alanında hata gösterilir
- Diğer exception'lar → Genel hata mesajı gösterilir

**⚠️ Not:** Bu format çalışır ancak önerilen formatları kullanmak daha iyi kullanıcı deneyimi sağlar.

---

## 🎯 Özet

- ✅ Backend'den `errorType` veya `field` ile hata gönderin (Önerilen)
- ✅ Spring Boot exception formatı da desteklenir
- ✅ Frontend otomatik olarak doğru alanda hata gösterir
- ✅ Kullanıcı hangi alanın yanlış olduğunu net bir şekilde görür
- ✅ Modern ve kullanıcı dostu bir deneyim sunulur

