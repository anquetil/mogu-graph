import { Bytes, BigInt, ethereum, log } from '@graphprotocol/graph-ts';
import { extractTitle } from './custom-types/ParsedProposalV3';
import {
  CandidateFeedbackSent,
  FeedbackSent,
  ProposalCandidateCanceled,
  ProposalCandidateCreated,
  ProposalCandidateUpdated,
  SignatureAdded,
} from './types/NounsDAOData/NounsDAOData';
import { CustomCandidateEvent, CustomFeedbackEvent, ProposalCandidateContent, ProposalCandidateVersion } from './types/schema';
import {
  candidateID,
  getOrCreateCandidateFeedback,
  getOrCreateDelegate,
  getOrCreateProposalCandidate,
  getOrCreateProposalCandidateContent,
  getOrCreateProposalCandidateSignature,
  getOrCreateProposalCandidateVersion,
  getOrCreateProposalFeedback,
} from './utils/helpers';

export function handleProposalCandidateCreated(event: ProposalCandidateCreated): void {
  const candidate = getOrCreateProposalCandidate(
    candidateID(event.params.msgSender, event.params.slug),
  );

  candidate.proposer = event.params.msgSender;
  candidate.slug = event.params.slug;
  candidate.createdTransactionHash = event.transaction.hash;
  candidate.createdTimestamp = event.block.timestamp;
  candidate.createdBlock = event.block.number;
  candidate.lastUpdatedTimestamp = event.block.timestamp;
  candidate.lastUpdatedBlock = event.block.number;
  candidate.canceled = false;

   // MOGU CODE
   let customCandidate = new CustomCandidateEvent(event.transaction.hash.toHexString()
      .concat('-')
      .concat(event.params.slug.toString()));

   customCandidate.eventName = "customCandidate";
   customCandidate.hash = event.transaction.hash;
   customCandidate.block = event.block.number;
   customCandidate.timestamp = event.block.timestamp;
   customCandidate.from = event.params.msgSender;
   customCandidate.involved = [event.params.msgSender];
   customCandidate.slug = event.params.slug;
   customCandidate.targets = changetype<Bytes[]>(event.params.targets);
   customCandidate.values = event.params.values;
   customCandidate.signatures = event.params.signatures;
   customCandidate.calldatas = event.params.calldatas;
   customCandidate.title = extractTitle(event.params.description);
   customCandidate.description = event.params.description;
   customCandidate.updateMessage = ""

   customCandidate.save()
   /* END MOGU CODE */

  const version = captureProposalCandidateVersion(
    event.transaction.hash.toHexString(),
    event.logIndex.toString(),
    candidate.id,
    changetype<Bytes[]>(event.params.targets),
    event.params.values,
    event.params.signatures,
    event.params.calldatas,
    event.params.description,
    event.params.proposalIdToUpdate,
    event.params.encodedProposalHash,
    event.block,
    candidate.proposer,
  );

  candidate.latestVersion = version.id;
  candidate.save();
}

export function handleProposalCandidateUpdated(event: ProposalCandidateUpdated): void {
  const candidate = getOrCreateProposalCandidate(
    candidateID(event.params.msgSender, event.params.slug),
  );

  candidate.lastUpdatedTimestamp = event.block.timestamp;
  candidate.lastUpdatedBlock = event.block.number;

   // MOGU CODE
   let customCandidate = new CustomCandidateEvent(event.transaction.hash.toHexString()
      .concat('-')
      .concat(event.params.slug.toString()));

   customCandidate.eventName = "customCandidate";
   customCandidate.hash = event.transaction.hash;
   customCandidate.block = event.block.number;
   customCandidate.timestamp = event.block.timestamp;
   customCandidate.from = event.params.msgSender;
   customCandidate.involved = [event.params.msgSender];
   customCandidate.slug = event.params.slug;
   customCandidate.targets = changetype<Bytes[]>(event.params.targets);
   customCandidate.values = event.params.values;
   customCandidate.signatures = event.params.signatures;
   customCandidate.calldatas = event.params.calldatas;
   customCandidate.title = extractTitle(event.params.description);
   customCandidate.description = event.params.description;
   customCandidate.updateMessage = event.params.reason;

   customCandidate.save()
   /* END MOGU CODE */

  const version = captureProposalCandidateVersion(
    event.transaction.hash.toHexString(),
    event.logIndex.toString(),
    candidate.id,
    changetype<Bytes[]>(event.params.targets),
    event.params.values,
    event.params.signatures,
    event.params.calldatas,
    event.params.description,
    event.params.proposalIdToUpdate,
    event.params.encodedProposalHash,
    event.block,
    candidate.proposer,
    event.params.reason,
  );

  candidate.latestVersion = version.id;
  candidate.save();
}

export function handleProposalCandidateCanceled(event: ProposalCandidateCanceled): void {
  const candidate = getOrCreateProposalCandidate(
    candidateID(event.params.msgSender, event.params.slug),
  );

  candidate.canceled = true;
  candidate.canceledTimestamp = event.block.timestamp;
  candidate.canceledBlock = event.block.number;

  candidate.save();
}

export function handleSignatureAdded(event: SignatureAdded): void {
  const sigId = event.params.signer
    .toHexString()
    .concat('-')
    .concat(event.params.sig.toHexString());
  const candidateSig = getOrCreateProposalCandidateSignature(sigId);
  const candidate = getOrCreateProposalCandidate(
    candidateID(event.params.proposer, event.params.slug),
  );

  const latestVersion = ProposalCandidateVersion.load(candidate.latestVersion)!;
  const latestContent = ProposalCandidateContent.load(latestVersion.content)!;
  if (latestContent.encodedProposalHash != event.params.encodedPropHash) {
    log.error('Wrong encodedProposalHash. Latest version: {}. Event: {}. tx_hash: {}', [
      latestContent.encodedProposalHash.toHexString(),
      event.params.encodedPropHash.toHexString(),
      event.transaction.hash.toHexString(),
    ]);
    return;
  }

  candidateSig.content = latestVersion.content;
  candidateSig.signer = getOrCreateDelegate(event.params.signer.toHexString()).id;
  candidateSig.sig = event.params.sig;
  candidateSig.expirationTimestamp = event.params.expirationTimestamp;
  candidateSig.encodedProposalHash = event.params.encodedPropHash;
  candidateSig.sigDigest = event.params.sigDigest;
  candidateSig.reason = event.params.reason;

  candidateSig.save();
}

export function handleFeedbackSent(event: FeedbackSent): void {
  const id = event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString());
  const feedback = getOrCreateProposalFeedback(id);
  const delegate = getOrCreateDelegate(event.params.msgSender.toHexString());

  feedback.createdTimestamp = event.block.timestamp;
  feedback.createdBlock = event.block.number;
  feedback.proposal = event.params.proposalId.toString();
  feedback.voter = delegate.id;
  feedback.supportDetailed = event.params.support;
  feedback.votes = delegate.delegatedVotes;
  feedback.reason = event.params.reason;

  feedback.save();

   /* MOGU CODE */
   let customFeedback = new CustomFeedbackEvent(event.transaction.hash.toHexString()
      .concat('-')
      .concat(event.params.proposalId.toString()));

   customFeedback.eventName = "customFeedback";
   customFeedback.hash = event.transaction.hash;
   customFeedback.block = event.block.number;
   customFeedback.timestamp = event.block.timestamp;
   customFeedback.from = event.params.msgSender;
   customFeedback.involved = [event.params.msgSender];
   customFeedback.candidate = false;
   customFeedback.propID = event.params.proposalId.toString();
   customFeedback.votes = delegate.delegatedVotes;
   customFeedback.supportDetailed = event.params.support;
   customFeedback.reason = event.params.reason;

   customFeedback.save()

   /* END MOGU */
}

export function handleCandidateFeedbackSent(event: CandidateFeedbackSent): void {
  const id = event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString());
  const feedback = getOrCreateCandidateFeedback(id);
  const delegate = getOrCreateDelegate(event.params.msgSender.toHexString());
  const candidate = candidateID(event.params.proposer, event.params.slug);

  feedback.createdTimestamp = event.block.timestamp;
  feedback.createdBlock = event.block.number;
  feedback.candidate = candidate;
  feedback.voter = delegate.id;
  feedback.supportDetailed = event.params.support;
  feedback.votes = delegate.delegatedVotes;
  feedback.reason = event.params.reason;

  feedback.save();

  /* MOGU CODE */
   let customFeedback = new CustomFeedbackEvent(event.transaction.hash.toHexString()
      .concat('-')
      .concat(event.params.slug.toString()));

   customFeedback.eventName = "customFeedback";
   customFeedback.hash = event.transaction.hash;
   customFeedback.block = event.block.number;
   customFeedback.timestamp = event.block.timestamp;
   customFeedback.from = event.params.msgSender;
   customFeedback.involved = [event.params.msgSender];
   customFeedback.candidate = true;
   customFeedback.propID = event.params.slug;
   customFeedback.votes = delegate.delegatedVotes;
   customFeedback.supportDetailed = event.params.support;
   customFeedback.reason = event.params.reason;

   customFeedback.save()

   /* END MOGU */

}

function captureProposalCandidateVersion(
  txHash: string,
  logIndex: string,
  candidateId: string,
  targets: Bytes[],
  values: BigInt[],
  signatures: string[],
  calldatas: Bytes[],
  description: string,
  proposalIdToUpdate: BigInt,
  encodedProposalHash: Bytes,
  block: ethereum.Block,
  proposer: Bytes,
  updateMessage: string = '',
): ProposalCandidateVersion {
  const content = getOrCreateProposalCandidateContent(encodedProposalHash.toHexString());
  content.targets = targets;
  content.values = values;
  content.signatures = signatures;
  content.calldatas = calldatas;
  content.description = description;
  content.proposalIdToUpdate = proposalIdToUpdate;
  content.title = extractTitle(description);
  content.proposer = proposer;
  content.encodedProposalHash = encodedProposalHash;
  content.matchingProposalIds = [];
  content.save();

  const versionId = txHash.concat('-').concat(logIndex);
  const version = getOrCreateProposalCandidateVersion(versionId);
  version.content = content.id;
  version.proposal = candidateId;
  version.createdTimestamp = block.timestamp;
  version.createdBlock = block.number;
  version.updateMessage = updateMessage;
  version.save();

  return version;
}
