const { MqttWs } = require('azure-iot-provisioning-device-mqtt');
const { SymmetricKeySecurityClient } = require('azure-iot-security-symmetric-key');
const { ProvisioningDeviceClient } = require('azure-iot-provisioning-device');
const { Client: DeviceClient, Message } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');

module.exports = async function (context, mySbMsg) {
    context.log("🔔 Nachricht empfangen:");
    context.log(JSON.stringify(mySbMsg, null, 2));

    const idScope = process.env.IOTC_ID_SCOPE;
    const deviceId = process.env.IOTC_DEVICE_ID;
    const deviceKey = process.env.IOTC_DEVICE_KEY;
    const modelId = process.env.IOTC_MODEL_ID || null;

    if (!idScope || !deviceId || !deviceKey) {
        context.log("❌ Umgebungsvariablen fehlen (IOTC_ID_SCOPE, IOTC_DEVICE_ID, IOTC_DEVICE_KEY).");
        return;
    }

    const provisioningHost = 'global.azure-devices-provisioning.net';
    const symmetricKeyClient = new SymmetricKeySecurityClient(deviceId, deviceKey);
    const provisioningClient = ProvisioningDeviceClient.create(
        provisioningHost,
        idScope,
        new MqttWs(),
        symmetricKeyClient
    );

    if (modelId) {
        provisioningClient.setProvisioningPayload({ iotcModelId: modelId });
    }

    try {
        const registrationResult = await provisioningClient.register();
        context.log(`✅ Registrierung erfolgreich: ${registrationResult.assignedHub}`);

        const connectionString = `HostName=${registrationResult.assignedHub};DeviceId=${deviceId};SharedAccessKey=${deviceKey}`;
        const deviceClient = DeviceClient.fromConnectionString(connectionString, Mqtt);

        await deviceClient.open();

        const telemetry = {
            temperature_sht: mySbMsg.object?.TempC_SHT || null,
            temperature_tmp117: mySbMsg.object?.TempC_TMP117 || null,
            temperature_ds: mySbMsg.object?.TempC_DS || null,
            humidity_sht: mySbMsg.object?.Hum_SHT || null,
            ext_humidity_sht: mySbMsg.object?.Ext_Hum_SHT || null,
            battery_voltage: mySbMsg.object?.BatV || null,
            battery_status: mySbMsg.object?.Bat_status || null,
            external_sensor: mySbMsg.object?.Ext_sensor || null
        };

        context.log("📤 Sende Telemetrie:", telemetry);

        const message = new Message(JSON.stringify(telemetry));
        await deviceClient.sendEvent(message);

        context.log("✅ Telemetrie erfolgreich gesendet.");
        await deviceClient.close();

    } catch (err) {
        context.log("❌ Fehler beim Senden:", err.message);
    }
};
