export interface EvidenceMaterial { id: string; date?: string; periodStart?: string; body: string }
export interface EvidencePacket { sourceIds: string[]; period: string; facts: string[]; quotes: string[]; actions: string[] }

export const estimateTokens = (text: string) => Math.ceil(text.length / 2);
export function buildEvidencePackets(materials: EvidenceMaterial[], budget: number): EvidencePacket[] {
  const packets: EvidencePacket[] = [];
  for (const material of materials) {
    const chars = Math.max(2, budget * 2);
    for (let offset = 0; offset < material.body.length; offset += chars) {
      const fragment = material.body.slice(offset, offset + chars);
      packets.push({ sourceIds: [material.id], period: material.date ?? material.periodStart ?? '', facts: [fragment], quotes: [fragment], actions: [] });
    }
  }
  return packets;
}
