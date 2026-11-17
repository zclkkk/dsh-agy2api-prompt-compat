# dsh-agy2api-prompt-compat

DeepSeek Harness 的 agy2api 提示词兼容补丁。先在 Harness 中配置好 [agy2api](https://github.com/zclkkk/agy2api) Provider，再将插件装进使用它的 profile。

插件在 Harness 组装系统提示词时，调整内置身份介绍、Web GUI 指引和 `@` 文件引用说明的措辞。启用范围是整个 profile，切换 Provider 后仍然生效。

## 安装

以下命令将插件装进 `web` profile。

```sh
git clone https://github.com/zclkkk/dsh-agy2api-prompt-compat.git
dsh plugin --profile web add ./dsh-agy2api-prompt-compat
```

启动或重启该 profile，在新会话中使用。安装方式会链接本地仓库，请保留该目录。

## 停用

在该 profile 的 `cordis.patch.yml` 中加入以下设置。

```yaml
- id: dsh-agy2api-prompt-compat
  disabled: true
```

将 `disabled` 改为 `false` 可恢复启用。要卸载插件，先移除上面的配置（如果添加过），再运行以下命令。

```sh
dsh plugin --profile web remove dsh-agy2api-prompt-compat
```
