#ifndef ROLE_DRONE_H
#define ROLE_DRONE_H

#include <Arduino.h>
#include "messageProtocol.h"

void initDroneRelay();
void updateDroneRelay();
void handleDroneRelayIncoming(SkyMessage& msg);

#endif // ROLE_DRONE_H
