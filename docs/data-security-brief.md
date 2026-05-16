# Twiny Data Security Brief

Bu dokuman, Twiny'yi veri guvenligi sorularina karsi anlatmak icin kullanilacak sunum mantigidir. Ana pozisyonumuz basit: Twiny kullanicinin dijital hayatini merkezilesmis bir cloud profilinde toplamaz; hassas baglam local-first tutulur, agent sadece sinirli izinlerle okur/hazirlar, dis dunyaya etki eden her aksiyon onay kapisindan gecer.

## 1. Ana Guvenlik Tezi

**Twiny bir "cloud data hoarder" degil, approval-gated personal agent runtime'dir.**

Twiny'nin guvenlik modeli uc katmana dayanir:

1. **Data minimization:** Agent'a gorev icin gereken minimum veri verilir. Raw mail, takvim, sosyal ve wallet baglami merkezi bir kullanici profili olarak saklanmaz.
2. **Non-custodial control:** Private key, seed phrase ve imza yetkisi Twiny'ye verilmez. Twiny transaction hazirlar; wallet/Privy kullaniciya native imza ekranini acar.
3. **Deterministic policy gate:** LLM karar vermez, sadece intent cikarir. Para, kimlik, itibar veya yetki etkileyen aksiyonlarda kural tabanli Policy Engine onay veya blok karari verir.

Tek cumlelik cevap:

> Twiny can understand your context, but it cannot silently take control of your money, identity, reputation, or permissions.

Turkce:

> Twiny baglamini anlayabilir, ama paran, kimligin, itibarin veya izinlerin uzerinde sessizce kontrol alamaz.

## 2. MVP'de Bugun Neyi Gercekten Yapiyoruz?

Sunumda iddialari ikiye ayirmaliyiz: **MVP'de calisan guvenlik sinirlari** ve **production hedefi**.

MVP'de calisan sinirlar:

- Intent routing local/deterministik calisir; action execute etmez.
- Backend raw wallet, mail veya takvim datasini LLM servislerine gondermez.
- Wallet Agent sadece balance/campaign okur ve claim transaction calldata'si hazirlar.
- Frontend transaction'i Privy `sendTransaction` ile kullaniciya imzalatir; Twiny signed payload veya private key gormez.
- Policy Engine AI cagrisi yapmaz; deterministik if/else kurallariyla external content, unlimited approval, money movement ve communication action'larini kontrol eder.
- Approval Card kullaniciya reward, risk, data shared, on-chain call ve cloud usage bilgisini gosterir.
- ElevenLabs API key artik frontend'e verilmez; STT/TTS backend proxy uzerinden calisir.

Production hedefi:

- Local Memory Vault cihazda sifreli saklanacak.
- OAuth token'lari OS secure storage/keychain icinde tutulacak.
- Mail/calendar/social connector'lar default olarak selected-thread veya narrow-scope modda calisacak.
- On-device STT/local model opsiyonu eklenecek.
- Data retention ve deletion kontrolleri kullanici dashboard'una alinacak.
- Optional encrypted backup kullanici anahtariyla sifrelenecek; Twiny server plaintext gormeyecek.

Sunum cumlesi:

> MVP already proves the key safety property: the agent can recommend and prepare, but execution is gated by deterministic policy plus wallet/user approval. Production hardens storage, OAuth, local memory, and on-device inference.

## 3. Veri Siniflandirma Modeli

Twiny'de tum veri ayni hassasiyette degil. Sorulara cevap verirken bu siniflandirmayi kullan.

**Public data**

- Campaign list
- Public Monad contract events
- Public bounty/task metadata
- Public community events

Kural: Cloud/indexer tarafinda tutulabilir.

**User-scoped operational data**

- Wallet address
- Claim eligibility
- Selected campaign interaction
- Selected transcript
- User risk preference

Kural: Gorev icin minimum kullanilir; approval card'da "Data used/shared" olarak gosterilir.

**Sensitive personal context**

- Raw email body
- Calendar details
- Social/DM content
- Personal preferences/history
- Rejection/approval memory

Kural: Local Memory Vault'ta tutulur; cloud'a raw sekilde tasinmaz.

**Custody-critical secrets**

- Private key
- Seed phrase
- Signed transaction payload before wallet confirmation
- OAuth refresh tokens

Kural: Twiny application layer bu verileri sahiplenmez. Private key wallet/Privy tarafinda kalir; OAuth token'lari OS secure storage ile korunur.

## 4. Action Permission Logic

Twiny'nin aksiyon modeli dort seviyeli anlatilmali:

1. **Read:** Veri okur. Ornek: wallet balance, selected email thread, campaign list.
2. **Analyze:** Veriyi anlamlandirir. Ornek: risk skoru, reward/time ratio, deadline.
3. **Prepare:** Aksiyon taslagi hazirlar. Ornek: email draft, claim transaction preview.
4. **Execute:** Dunya durumunu degistirir. Ornek: send email, sign transaction, publish post, token approval.

Ana kural:

> Read/analyze/prepare can be delegated. Execute must be approved.

Turkce:

> Okuma, analiz ve hazirlik delege edilebilir; icra kullanici onayina baglidir.

Her zaman manuel onay isteyen aksiyonlar:

- Para hareketi
- Wallet signature
- Token approval
- Mail gonderimi veya forward
- Public social post
- DM gonderimi
- Kisisel veri paylasimi
- Yeni uygulamaya izin verme
- Identity/reputation etkileyen submission

Policy Engine prensibi:

> LLM suggests. Policy Engine decides what is allowed. Wallet/user approves execution.

## 5. Kritik Riskler ve Cevap Mantigi

### Risk: "Mail + wallet + takvim birlesince cok hassas profil olusmuyor mu?"

Kisa cevap:

> Evet, bu yuzden Twiny'nin ana tasarimi cloud-first degil local-first. Urunun farki, bu baglami merkezi server'a toplamak yerine cihazdaki encrypted memory ve scoped connector'lar uzerinden kullanmasi.

Teknik dayanak:

- Data minimization
- Local Memory Vault
- Selected-thread/narrow-scope connector modeli
- No central raw profile database
- User-controlled retention/deletion
- Approval Card'da data used/shared alanlari

Sunum dili:

> Bizim icin asil rakip "daha akilli agent" degil; "veriyi cloud'a yigmadan akilli kalabilen agent".

### Risk: "LLM prompt injection ile kullanici adina islem yaptirabilir mi?"

Kisa cevap:

> Hayir. Email veya web icerigi kullanici komutu sayilmaz; external content untrusted data olarak islenir. LLM tool permission veremez, Policy Engine verir.

Teknik dayanak:

- `source: email_content | web_content` aksiyonlari Policy Engine tarafindan bloklanir.
- Tool outputs permission grant edemez.
- Execution icin kullanicinin direct command + approval card + wallet confirmation akisi gerekir.

Sunum cumlesi:

> A mail can inform Twiny; it cannot command Twiny.

### Risk: "Twiny benim cuzdanimdan para cekebilir mi?"

Kisa cevap:

> Hayir. Twiny private key tutmaz, seed phrase bilmez, imza atamaz. Sadece transaction hazirlar; imza wallet/Privy ekraninda kullanici tarafindan verilir.

Teknik dayanak:

- Wallet Agent read-first/prepare-second calisir.
- Frontend `sendTransaction` ile wallet provider'a gider.
- Approval Card tx target, action, risk ve data shared gosterir.
- Unlimited approval default bloklanir.

Sunum cumlesi:

> Twiny prepares transactions; your wallet signs them.

### Risk: "Cloud hic kullanilmiyor mu?"

Kisa cevap:

> MVP'de bazi cloud servisleri var; ama guvenlik prensibi cloud'u minimum ve hassas olmayan islerle sinirlamak. Cloud kullanimi saklanmiyor, approval card'da gosteriliyor.

Bugun cloud kullanimlari:

- ElevenLabs: STT/TTS, backend proxy arkasinda.
- Monad RPC/indexing: public chain state/campaign data.
- Privy: wallet auth/signing layer.

Production hedefi:

- On-device STT/local model secenegi
- Encrypted backup only
- Raw personal data cloud'a gitmez
- Cloud usage mode dashboard'u

Sunum cumlesi:

> The honest version is not "no cloud ever"; it is "no centralized sensitive user profile, no custody, no silent execution."

### Risk: "Cihaz ele gecirilirse local memory de riskli degil mi?"

Kisa cevap:

> Evet, local-first cihaz guvenligine dayanir; bu yuzden vault encryption, biometric unlock, OS secure storage, auto-lock ve memory expiration gerekir.

Teknik dayanak:

- Local Memory Vault encryption
- Keychain/Secure Enclave/biometric unlock
- Session auto-lock
- Data retention controls
- Remote wipe
- Optional encrypted backup

Sunum cumlesi:

> Local-first riskleri sifirlamaz; riski merkezi toplu ihlalden kullanicinin kontrol ettigi cihaz guvenligi modeline tasir.

### Risk: "Finansal tavsiye veya auto-trading regulasyonuna giriyor mu?"

Kisa cevap:

> Twiny auto-trading botu veya finansal danisman degildir. MVP'de trade yok; risk aciklamasi, simulation ve kullanici onayli claim/transaction hazirligi var.

Sinirlar:

- No auto trading
- No profit guarantee
- No investment advice wording
- No autonomous high-risk execution
- Manual wallet approval only

Sunum cumlesi:

> We explain risk and prepare actions; we do not give discretionary investment advice or autonomously trade.

## 6. Approval Card Neyi Kanitliyor?

Approval Card sadece UX degil, guvenlik kontratidir.

Kartta gosterilmesi gereken alanlar:

- Action
- Reward/benefit
- Estimated time
- Risk level
- Data used
- Data shared
- Cloud used
- On-chain action
- Contract address
- Warnings/block reason
- Reject/Edit/Approve controls

Juriye soylenebilecek cumle:

> The approval card makes the invisible parts of agentic systems visible: what will happen, what data is used, what risk exists, and where the final authority sits.

Turkce:

> Approval Card, agent sistemlerinde normalde gorunmeyen seyleri gorunur yapar: ne olacak, hangi veri kullanildi, risk ne ve son yetki kimde.

## 7. "Say This / Don't Say This"

**Say this**

- "Local-first and cloud-minimized."
- "Non-custodial: Twiny never holds private keys."
- "LLM routes intent; deterministic policy controls permissions."
- "External content is treated as untrusted data."
- "Money, identity, reputation and permissions always require explicit approval."
- "MVP proves the approval-gated execution model; production hardens local vault, OAuth and on-device inference."

**Don't say this**

- "No data ever goes to cloud." Bu MVP icin dogru degil.
- "Fully autonomous digital twin." Yanlis ve korkutucu.
- "We store everything locally forever." Data minimization ile celisir.
- "AI decides whether a transaction is safe." Karari Policy Engine + wallet/user approval verir.
- "This is a trading agent." Regulasyon riskini artirir.

## 8. Sunumda 45 Saniyelik Guvenlik Anlatimi

> Twiny is designed around one safety promise: it can think for the user, but it cannot act against the user. We keep sensitive context local-first, avoid building a central raw profile database, and use scoped connectors instead of full-account access by default. The LLM is not the authority layer; it only classifies intent. A deterministic Policy Engine decides whether an action is allowed, requires approval, or must be blocked. Anything touching money, identity, reputation, permissions, email sending, public posting, or wallet signing goes through an Approval Card and then the user's wallet or app-native confirmation. In the MVP, this is already visible: the agent finds a Monad opportunity, prepares a claim transaction, shows risk/data/cloud usage, and Privy handles the final signature. Twiny prepares; the user approves; the wallet signs.

Turkce versiyon:

> Twiny'nin guvenlik vaadi su: kullanici icin dusunebilir ama kullaniciya ragmen hareket edemez. Hassas baglami local-first tutuyoruz, merkezi raw profil veritabani kurmuyoruz ve connector'lari default olarak dar izinlerle calistiriyoruz. LLM yetki katmani degil; sadece intent siniflandiriyor. Aksiyonun izinli mi, onay gerektiriyor mu, yoksa bloklanmasi mi gerekiyor buna deterministik Policy Engine karar veriyor. Para, kimlik, itibar, izin, mail gonderimi, public post veya wallet imzasi etkileniyorsa Approval Card ve kullanici onayi zorunlu. MVP'de bu akisi gosteriyoruz: agent Monad firsatini buluyor, claim transaction hazirliyor, risk/veri/cloud bilgisini gosteriyor ve son imza Privy wallet ekraninda kullanicida kaliyor. Twiny hazirlar; kullanici onaylar; wallet imzalar.

## 9. Uygulama Notlari

Mevcut kodda guvenlik anlatimini destekleyen noktalar:

- `backend/src/orchestrator.ts`: LLM sadece intent routing icin kullaniliyor.
- `backend/src/policy/engine.ts`: Policy Engine deterministik ve AI API cagirmiyor.
- `backend/src/agents/walletAgent.ts`: Wallet Agent balance/campaign okuyor, claim calldata hazirliyor, imzalamiyor.
- `frontend/src/components/approval/ApprovalCard.tsx`: Transaction onayi wallet provider uzerinden kullaniciya gidiyor.
- `backend/src/index.ts`: STT/TTS API key'leri backend proxy arkasinda tutuluyor.
- `contracts/src/TwinyCampaign.sol`: MVP contract'i claim odakli, basit ve auditable.

Oncelikli guvenlik backlog'u:

1. Local Memory Vault encryption ekle.
2. OAuth token storage icin OS keychain/Secure Enclave modeli belirle.
3. Gmail connector'i selected-thread/narrow-scope modda baslat.
4. Approval Card'a contract address, recipient ve method selector preview ekle.
5. Policy Engine'e action source ve user-direct-command ayrimini frontend/backend boyunca zorunlu alan yap.
6. On-device STT veya user-selectable "cloud voice off" modu ekle.
7. Data retention dashboard'u ekle.
8. Smart contract icin basic tests ve reentrancy guard degerlendirmesi yap.
