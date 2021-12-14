import axios from 'axios'
import config from '#config'
import getAccessToken from 'server/getAccessToken'
import { IncomingMessage, ServerResponse } from 'http'
import { URLSearchParams } from 'url'

export default async (req: IncomingMessage, res: ServerResponse) => {
    const result = {
        content: '',
        contentType: '',
        settings: {},
        password: false
    }

    const articleId = (new URLSearchParams(req.url)).get('id')
    const articlePassword = (new URLSearchParams(req.url)).get('password')

    if (articleId === 'arect') {
        return {
            contentUrl: 'https://www.kanofans.com',
            contentType: 'html',
            settings: {},
            password: false
        }
    }

    const accessToken = await getAccessToken(false)
    if (accessToken.error) {
        return result
    }

    let itemsCache = []

    const path = config.ONEDRIVE_URI + '/items/' + articleId + '/children'
    await axios.get(
        path + '?select=name,@microsoft.graph.downloadUrl',
        { headers: { Authorization: 'bearer ' + accessToken.token } }
    ).then((response) => {
        itemsCache = response.data.value
        res.statusCode = 200
    }).catch((error) => {
        res.statusCode = error.response.status
    })

    if (res.statusCode !== 200) {
        return result
    }

    const settingItem = itemsCache.find(item => (item.name === 'settings.json' || item.name === 'Settings.json'))
    let settings = { password: '' }
    if (settingItem !== undefined) {
        await axios.get(settingItem['@microsoft.graph.downloadUrl'])
            .then((response) => {
                settings = response.data
            })
            .catch((error) => {
                res.statusCode = error.response.status
            })
        if (res.statusCode !== 200) {
            return result
        }
    }

    if (settings['password'] === undefined || settings['password'] === articlePassword) {
        result.settings = settings
        result.settings['password'] = ''
    }
    else {
        result.password = true
        return result
    }

    const fileIndex = [
        'index.html',
        'index.md',
        'index.txt'
    ]

    for (const fi of fileIndex) {
        const temp = itemsCache.find(item => item.name === fi)
        if (temp !== undefined) {
            var contentUrl = temp['@microsoft.graph.downloadUrl']
            axios.get(contentUrl)
                    .then((contentResponse) => {
                        result.content = contentResponse.data
                    })
            result.contentType = fi.split('.')[1]
            return result
        }
    }

    return result
}
