import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(20);
Config.setPixelFormat('yuv420p');
Config.setChromiumOpenGlRenderer('angle');
