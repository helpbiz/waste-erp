/**
 * KMS Provider 추상화 — Master Key 도출
 *
 * Envelope encryption 패턴:
 *  - 평문 데이터 → DEK(Data Encryption Key, AES-256)로 암호화
 *  - DEK → KMS의 KEK(Key Encryption Key)로 암호화 → 환경변수에 저장
 *  - 앱 시작 시 KMS Decrypt API 1회 호출 → DEK 복호화 → 메모리 캐시
 *  - 모든 컬럼 암호화는 캐시된 DEK 사용 (KMS 호출 없음)
 *
 * Provider:
 *  - LOCAL  : MASTER_KEY_BASE64 직접 사용 (개발/테스트)
 *  - AWS_KMS: AWS KMS Decrypt API로 DEK 복호화 (운영 권장)
 *  - VAULT  : HashiCorp Vault Transit Engine /decrypt 엔드포인트
 *
 * 환경변수:
 *  KMS_PROVIDER=local|aws|vault
 *  MASTER_KEY_BASE64=...           (local)
 *  AWS_REGION=ap-northeast-2
 *  AWS_KMS_KEY_ID=arn:aws:kms:...  (encrypt에만 사용 — runtime에서 DEK 생성 시)
 *  AWS_KMS_ENCRYPTED_DEK_BASE64=... (운영 자주 사용 — 미리 암호화된 DEK)
 *  VAULT_ADDR=https://vault.example.com
 *  VAULT_TOKEN=...
 *  VAULT_KEY_NAME=wci-erp
 *  VAULT_ENCRYPTED_DEK=vault:v1:...
 */
import { createHash } from 'crypto';

export interface KmsProvider {
  name: string;
  /** 32-byte AES-256 데이터 키 반환 (캐시됨) */
  getDataKey(): Promise<Buffer>;
}

let cached: { provider: string; key: Buffer } | null = null;

class LocalKmsProvider implements KmsProvider {
  name = 'LOCAL';
  async getDataKey(): Promise<Buffer> {
    const b64 = process.env.KMS_LOCAL_KEY ?? process.env.MASTER_KEY_BASE64;
    if (b64) {
      const buf = Buffer.from(b64, 'base64');
      if (buf.length === 32) return buf;
    }
    /* dev fallback */
    const seed = process.env.JWT_SECRET ?? 'dev-secret-change-me-please-32-bytes-minimum-required';
    return createHash('sha256').update(seed + ':wci-health-encryption').digest();
  }
}

/**
 * AWS KMS Provider — envelope encryption
 *
 * 운영 셋업:
 *  1. KMS Customer Master Key (CMK) 생성: aws kms create-key --description 'wci-erp-master'
 *  2. Data Key 생성·암호화: aws kms generate-data-key --key-id <id> --key-spec AES_256
 *     → CiphertextBlob을 base64로 AWS_KMS_ENCRYPTED_DEK_BASE64에 저장
 *  3. 운영 시작 시 자동 Decrypt → 메모리 캐시
 *
 * AWS SDK 미설치 시 자동 폴백 (LOCAL).
 */
class AwsKmsProvider implements KmsProvider {
  name = 'AWS_KMS';
  async getDataKey(): Promise<Buffer> {
    const encryptedDek = process.env.AWS_KMS_ENCRYPTED_DEK_BASE64;
    if (!encryptedDek) {
      throw new Error('AWS_KMS_ENCRYPTED_DEK_BASE64 not set');
    }
    /* webpack 컴파일 회피 — 옵셔널 dependency. eval 사용으로 정적 분석 우회 */
    type KmsModule = {
      KMSClient: new (cfg: { region: string }) => { send: (cmd: unknown) => Promise<{ Plaintext?: Uint8Array }> };
      DecryptCommand: new (input: { CiphertextBlob: Buffer; KeyId?: string }) => unknown;
    };
    let sdk: KmsModule;
    try {
      const req = eval('require') as NodeRequire;
      sdk = req('@aws-sdk/client-kms') as KmsModule;
    } catch {
      throw new Error('AWS SDK not installed. Run: npm install @aws-sdk/client-kms');
    }
    const client = new sdk.KMSClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const out = await client.send(new sdk.DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedDek, 'base64'),
      ...(process.env.AWS_KMS_KEY_ID ? { KeyId: process.env.AWS_KMS_KEY_ID } : {}),
    }));
    if (!out.Plaintext) throw new Error('KMS Decrypt returned no plaintext');
    const buf = Buffer.from(out.Plaintext);
    if (buf.length !== 32) throw new Error(`KMS DEK length=${buf.length}, expected 32`);
    return buf;
  }
}

/**
 * HashiCorp Vault Transit Engine Provider
 *
 * 운영 셋업:
 *  1. vault secrets enable transit
 *  2. vault write -f transit/keys/wci-erp type=aes256-gcm96
 *  3. vault write transit/encrypt/wci-erp plaintext=<base64 DEK>
 *     → 응답의 ciphertext (vault:v1:...)를 VAULT_ENCRYPTED_DEK에 저장
 *  4. 운영 시작 시 transit/decrypt 호출 → DEK 캐시
 */
class VaultKmsProvider implements KmsProvider {
  name = 'VAULT';
  async getDataKey(): Promise<Buffer> {
    const addr = process.env.VAULT_ADDR;
    const token = process.env.VAULT_TOKEN;
    const ciphertext = process.env.VAULT_ENCRYPTED_DEK;
    const keyName = process.env.VAULT_KEY_NAME ?? 'wci-erp';
    if (!addr || !token || !ciphertext) {
      throw new Error('Vault env not set: VAULT_ADDR, VAULT_TOKEN, VAULT_ENCRYPTED_DEK');
    }
    const res = await fetch(`${addr}/v1/transit/decrypt/${keyName}`, {
      method: 'POST',
      headers: { 'X-Vault-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ciphertext }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Vault decrypt failed: ${res.status}`);
    const data = (await res.json()) as { data?: { plaintext?: string } };
    const plaintextB64 = data?.data?.plaintext;
    if (!plaintextB64) throw new Error('Vault response missing plaintext');
    const buf = Buffer.from(plaintextB64, 'base64');
    if (buf.length !== 32) throw new Error(`Vault DEK length=${buf.length}, expected 32`);
    return buf;
  }
}

function selectProvider(): KmsProvider {
  const p = (process.env.KMS_PROVIDER ?? 'local').toLowerCase();
  if (p === 'aws' || p === 'aws_kms' || p === 'aws-kms') return new AwsKmsProvider();
  if (p === 'vault') return new VaultKmsProvider();
  return new LocalKmsProvider();
}

/** 외부 호출 진입점 — 메모리 캐시 + 폴백 */
export async function getMasterKey(): Promise<{ key: Buffer; provider: string }> {
  if (cached) return { key: cached.key, provider: cached.provider };
  const provider = selectProvider();
  let key: Buffer;
  let providerName = provider.name;
  try {
    key = await provider.getDataKey();
  } catch (e) {
    console.warn(`[kms] ${provider.name} failed, falling back to LOCAL:`, e);
    key = await new LocalKmsProvider().getDataKey();
    providerName = `${provider.name}-fallback`;
  }
  cached = { provider: providerName, key };
  return { key, provider: providerName };
}

export function clearKeyCache(): void {
  cached = null;
}
