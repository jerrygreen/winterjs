pub mod hmac;
pub mod md5;
pub mod sha;

use ion::{typedarray::ArrayBuffer, Context, Object, Value};

use super::{
    crypto_key::{CryptoKey, KeyFormat, KeyUsage},
    HeapKeyData,
};

// Some of the functions in this trait have no implementation,
// so we allow them to be unused for now. Should be removed once
// more crypto algorithms are implemented.
#[allow(unused)]
pub trait CryptoAlgorithm {
    fn name(&self) -> &'static str;

    fn get_jwk_identifier(&self) -> ion::Result<&'static str> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn encrypt<'cx>(
        &self,
        cx: &'cx Context,
        params: &Object,
        key: &CryptoKey,
        data: Vec<u8>,
    ) -> ion::Result<ArrayBuffer<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn decrypt<'cx>(
        &self,
        cx: &'cx Context,
        params: &Object,
        key: &CryptoKey,
        data: Vec<u8>,
    ) -> ion::Result<ArrayBuffer<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn sign<'cx>(
        &self,
        cx: &'cx Context,
        params: &Object,
        key: &CryptoKey,
        data: Vec<u8>,
    ) -> ion::Result<ArrayBuffer<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn verify(
        &self,
        cx: &Context,
        params: &Object,
        key: &CryptoKey,
        signature: Vec<u8>,
        data: Vec<u8>,
    ) -> ion::Result<bool> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn digest<'cx>(
        &self,
        cx: &'cx Context,
        params: &Object,
        data: Vec<u8>,
    ) -> ion::Result<ArrayBuffer<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn derive_bits<'cx>(
        &self,
        cx: &'cx Context,
        params: &Object,
        base_key: CryptoKey,
        length: usize,
    ) -> ion::Result<ArrayBuffer<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn wrap_key<'cx>(
        &self,
        cx: &'cx Context,
        params: &Object,
        format: KeyFormat,
        key: &CryptoKey,
        wrapping_key: CryptoKey,
    ) -> ion::Result<ArrayBuffer<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    #[allow(clippy::too_many_arguments)]
    fn unwrap_key<'cx>(
        &self,
        _cx: &'cx Context,
        _params: &Object,
        _format: KeyFormat,
        _wrapped_key: Vec<u8>,
        _unwrapping_key: &CryptoKey,
        _extractable: bool,
        _usages: Vec<KeyUsage>,
    ) -> ion::Result<ArrayBuffer<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn generate_key(
        &self,
        cx: &Context,
        params: &Object,
        extractable: bool,
        usages: Vec<KeyUsage>,
    ) -> ion::Result<CryptoKey> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn import_key(
        &self,
        cx: &Context,
        params: &Object,
        format: KeyFormat,
        key_data: HeapKeyData,
        extractable: bool,
        usages: Vec<KeyUsage>,
    ) -> ion::Result<CryptoKey> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn export_key<'cx>(
        &self,
        cx: &'cx Context,
        format: KeyFormat,
        key: &CryptoKey,
    ) -> ion::Result<Value<'cx>> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }

    fn get_key_length(&self, cx: &Context, params: &Object) -> ion::Result<usize> {
        Err(ion::Error::new(
            "Operation not supported by the specified algorithm",
            ion::ErrorKind::Normal,
        ))
    }
}
