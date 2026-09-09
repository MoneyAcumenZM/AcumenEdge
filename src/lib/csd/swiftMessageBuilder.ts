import { SWIFTPayload } from '../ats/types';

export function buildMT541(payload: SWIFTPayload, messageId: string): string {
  return `{1:F01LUSEZMLUXXX0000000000}
{2:I541INFTYZMLXXXN}
{4:
:16R:GENL
:20C::SEME//${messageId}
:23G:NEWM
:98A::SETT//${payload.settlementDate}
:16S:GENL
:16R:TRADDET
:35B:ISIN ${payload.isinCode}
/${payload.securityDescription}
:36B::SETT//UNIT/${payload.quantity}
:90A::DEAL//PRCT/${payload.price?.toFixed(4)}
:16S:TRADDET
:16R:SETDET
:22F::SETR//TRAD
:16R:AMT
:19A::SETT//ZMW${payload.settlementAmount?.toFixed(2)}
:16S:AMT
:16R:SETPRTY
:95P::DEAG//LUSEZMLUXXX
:97A::SAFE//${payload.buyerAccount}
:16S:SETPRTY
:16R:SETPRTY
:95P::PSET//LUSEZMLUXXX
:16S:SETPRTY
-}`;
}

export function buildMT543(payload: SWIFTPayload, messageId: string): string {
  return `{1:F01LUSEZMLUXXX0000000000}
{2:I543INFTYZMLXXXN}
{4:
:16R:GENL
:20C::SEME//${messageId}
:23G:NEWM
:98A::SETT//${payload.settlementDate}
:16S:GENL
:16R:TRADDET
:35B:ISIN ${payload.isinCode}
/${payload.securityDescription}
:36B::SETT//UNIT/${payload.quantity}
:90A::DEAL//PRCT/${payload.price?.toFixed(4)}
:16S:TRADDET
:16R:SETDET
:22F::SETR//TRAD
:16R:AMT
:19A::SETT//ZMW${payload.settlementAmount?.toFixed(2)}
:16S:AMT
:16R:SETPRTY
:95P::DEAG//LUSEZMLUXXX
:97A::SAFE//${payload.sellerAccount}
:16S:SETPRTY
-}`;
}

export function buildMT548(payload: SWIFTPayload, messageId: string): string {
  return `{1:F01LUSEZMLUXXX0000000000}
{2:O548INFTYZMLXXXN}
{4:
:16R:GENL
:20C::SEME//${messageId}
:23G:NEWM
:16S:GENL
:16R:STAT
:25D::IPRC//PACK
:36B::SETT//UNIT/${payload.quantity}
:16S:STAT
-}`;
}

export function buildMT535(payload: SWIFTPayload, messageId: string): string {
  return `{1:F01LUSEZMLUXXX0000000000}
{2:O535INFTYZMLXXXN}
{4:
:16R:GENL
:20C::SEME//${messageId}
:98A::PREP//${new Date().toISOString().slice(0, 10).replace(/-/g, '')}
:16S:GENL
:16R:SUBSAFE
:97A::SAFE//${payload.buyerAccount}
:16R:FIN
:35B:ISIN ${payload.isinCode}
/${payload.securityDescription}
:93B::AGGR//UNIT/${payload.quantity}
:16S:FIN
:16S:SUBSAFE
-}`;
}
