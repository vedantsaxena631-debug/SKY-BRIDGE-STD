#include "loopPrevention.h"

LoopPrevention loopFilter;

LoopPrevention::LoopPrevention() : headIndex(0), count(0) {
  clear();
}

bool LoopPrevention::alreadySeen(uint32_t msgID) {
  if (msgID == 0) {
    return false; // Heartbeats/Pings with msgID 0 are handled separately
  }
  for (uint8_t i = 0; i < count; i++) {
    if (recentIDs[i] == msgID) {
      return true;
    }
  }
  return false;
}

void LoopPrevention::markSeen(uint32_t msgID) {
  if (msgID == 0) return;

  recentIDs[headIndex] = msgID;
  headIndex = (headIndex + 1) % RECENT_ID_CAPACITY;
  if (count < RECENT_ID_CAPACITY) {
    count++;
  }
}

void LoopPrevention::clear() {
  headIndex = 0;
  count = 0;
  for (uint8_t i = 0; i < RECENT_ID_CAPACITY; i++) {
    recentIDs[i] = 0;
  }
}
